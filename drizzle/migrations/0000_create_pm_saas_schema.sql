-- Enums
CREATE TYPE public.app_role AS ENUM ('manager', 'developer');
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Profiles (id == auth.users.id for real accounts; demo profiles have standalone ids)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- One-time role claim at registration (cannot escalate later)
CREATE OR REPLACE FUNCTION public.claim_account(_name TEXT, _email TEXT, _role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.profiles (id, name, email)
  VALUES (uid, COALESCE(NULLIF(_name, ''), split_part(COALESCE(_email, 'member'), '@', 1)), _email)
  ON CONFLICT (id) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
                                 email = COALESCE(EXCLUDED.email, public.profiles.email);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, _role);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_account(TEXT, TEXT, public.app_role) TO authenticated;

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  deadline TIMESTAMPTZ,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects readable by authenticated" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "managers update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "managers delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'manager'));

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_developer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  deadline TIMESTAMPTZ,
  priority public.priority_level NOT NULL DEFAULT 'medium',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks readable by authenticated" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "managers or assignee update tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR assigned_developer_id = auth.uid());
CREATE POLICY "managers delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'manager'));

-- Subtasks
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtasks TO authenticated;
GRANT ALL ON public.subtasks TO service_role;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtasks readable by authenticated" ON public.subtasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignee or manager write subtasks" ON public.subtasks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_developer_id = auth.uid()));
CREATE POLICY "assignee or manager update subtasks" ON public.subtasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_developer_id = auth.uid()));
CREATE POLICY "assignee or manager delete subtasks" ON public.subtasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_developer_id = auth.uid()));

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable by authenticated" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated add own comment" ON public.comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "delete own comment" ON public.comments FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Activity feed
CREATE TABLE public.activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity TO authenticated;
GRANT ALL ON public.activity TO service_role;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity readable by authenticated" ON public.activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write activity" ON public.activity FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  audience public.app_role,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or broadcast notifications" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR (recipient_id IS NULL AND (audience IS NULL OR public.has_role(auth.uid(), audience))));
CREATE POLICY "update own or broadcast notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL);
CREATE POLICY "authenticated insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Notification triggers
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_developer_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_developer_id IS DISTINCT FROM OLD.assigned_developer_id) THEN
    INSERT INTO public.notifications (recipient_id, kind, title, body, task_id, project_id)
    VALUES (NEW.assigned_developer_id, 'task_assigned', 'New task assigned', NEW.title, NEW.id, NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER task_assigned_notify AFTER INSERT OR UPDATE OF assigned_developer_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD;
BEGIN
  SELECT * INTO t FROM public.tasks WHERE id = NEW.task_id;
  IF t.assigned_developer_id IS NOT NULL AND t.assigned_developer_id <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (recipient_id, kind, title, body, task_id, project_id)
    VALUES (t.assigned_developer_id, 'new_comment', 'New comment', left(NEW.body, 140), t.id, t.project_id);
  END IF;
  INSERT INTO public.notifications (audience, kind, title, body, task_id, project_id)
  VALUES ('manager', 'new_comment', 'New comment on ' || t.title, left(NEW.body, 140), t.id, t.project_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER comment_notify AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();

-- ===================== DEMO DATA =====================
INSERT INTO public.profiles (id, name, email, is_demo) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Nadia Chowdhury', 'nadia@northpeak.dev', true),
  ('11111111-1111-1111-1111-111111111102', 'Sarah Khan', 'sarah@northpeak.dev', true),
  ('11111111-1111-1111-1111-111111111103', 'Rahim Ahmed', 'rahim@northpeak.dev', true),
  ('11111111-1111-1111-1111-111111111104', 'John Smith', 'john@northpeak.dev', true),
  ('11111111-1111-1111-1111-111111111105', 'Ayesha Rahman', 'ayesha@northpeak.dev', true);

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111101', 'manager'),
  ('11111111-1111-1111-1111-111111111102', 'developer'),
  ('11111111-1111-1111-1111-111111111103', 'developer'),
  ('11111111-1111-1111-1111-111111111104', 'developer'),
  ('11111111-1111-1111-1111-111111111105', 'developer');

INSERT INTO public.projects (id, title, description, manager_id, start_date, deadline, priority) VALUES
  ('22222222-2222-2222-2222-222222222201', 'E-Commerce Platform', 'Storefront, cart, checkout and order management for a multi-vendor marketplace.', '11111111-1111-1111-1111-111111111101', now()::date - 40, now() + interval '18 days', 'high'),
  ('22222222-2222-2222-2222-222222222202', 'Mobile Banking Application', 'Secure account access, transfers and card controls for iOS and Android.', '11111111-1111-1111-1111-111111111101', now()::date - 25, now() + interval '9 days', 'critical'),
  ('22222222-2222-2222-2222-222222222203', 'Hospital Management System', 'Patient records, appointment scheduling and billing for a 300-bed hospital.', '11111111-1111-1111-1111-111111111101', now()::date - 60, now() - interval '3 days', 'high'),
  ('22222222-2222-2222-2222-222222222204', 'Learning Management System', 'Course authoring, enrolments and progress tracking for online cohorts.', '11111111-1111-1111-1111-111111111101', now()::date - 12, now() + interval '46 days', 'medium');

INSERT INTO public.tasks (id, project_id, title, description, assigned_developer_id, deadline, priority, is_completed, completed_at) VALUES
  ('33333333-3333-3333-3333-333333333301','22222222-2222-2222-2222-222222222201','Authentication API','JWT login, refresh tokens and password reset endpoints.','11111111-1111-1111-1111-111111111102', now() + interval '4 days','high',false,null),
  ('33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222201','Product catalogue service','Search, filtering and pagination across vendor catalogues.','11111111-1111-1111-1111-111111111103', now() + interval '1 day','critical',false,null),
  ('33333333-3333-3333-3333-333333333303','22222222-2222-2222-2222-222222222201','Checkout flow UI','Multi-step checkout with address book and saved cards.','11111111-1111-1111-1111-111111111104', now() - interval '2 days','high',false,null),
  ('33333333-3333-3333-3333-333333333304','22222222-2222-2222-2222-222222222201','Vendor onboarding forms','KYC upload and store profile setup.','11111111-1111-1111-1111-111111111105', now() - interval '6 days','medium',true, now() - interval '7 days'),
  ('33333333-3333-3333-3333-333333333305','22222222-2222-2222-2222-222222222201','Order history screen','Paginated order list with status timeline.','11111111-1111-1111-1111-111111111102', now() - interval '9 days','low',true, now() - interval '6 days'),
  ('33333333-3333-3333-3333-333333333306','22222222-2222-2222-2222-222222222202','Biometric login','Face ID and fingerprint unlock with secure enclave storage.','11111111-1111-1111-1111-111111111103', now() + interval '2 days','critical',false,null),
  ('33333333-3333-3333-3333-333333333307','22222222-2222-2222-2222-222222222202','Fund transfer engine','Internal and interbank transfers with idempotency keys.','11111111-1111-1111-1111-111111111102', now() + interval '12 days','high',false,null),
  ('33333333-3333-3333-3333-333333333308','22222222-2222-2222-2222-222222222202','Transaction statements','Filterable statements with PDF export.','11111111-1111-1111-1111-111111111105', now() - interval '1 day','medium',false,null),
  ('33333333-3333-3333-3333-333333333309','22222222-2222-2222-2222-222222222202','Card freeze controls','Instant freeze/unfreeze with audit log.','11111111-1111-1111-1111-111111111104', now() - interval '4 days','high',true, now() - interval '5 days'),
  ('33333333-3333-3333-3333-333333333310','22222222-2222-2222-2222-222222222203','Patient records module','Create, search and version patient medical records.','11111111-1111-1111-1111-111111111104', now() - interval '8 days','critical',false,null),
  ('33333333-3333-3333-3333-333333333311','22222222-2222-2222-2222-222222222203','Appointment scheduling','Doctor availability calendar with conflict detection.','11111111-1111-1111-1111-111111111105', now() + interval '3 days','high',false,null),
  ('33333333-3333-3333-3333-333333333312','22222222-2222-2222-2222-222222222203','Billing and invoices','Insurance split billing and receipt generation.','11111111-1111-1111-1111-111111111103', now() - interval '2 days','medium',true, now() + interval '0 days'),
  ('33333333-3333-3333-3333-333333333313','22222222-2222-2222-2222-222222222203','Lab results import','HL7 ingestion of external lab results.','11111111-1111-1111-1111-111111111102', now() + interval '20 days','low',false,null),
  ('33333333-3333-3333-3333-333333333314','22222222-2222-2222-2222-222222222204','Course builder','Drag-and-drop lesson and module authoring.','11111111-1111-1111-1111-111111111105', now() + interval '15 days','high',false,null),
  ('33333333-3333-3333-3333-333333333315','22222222-2222-2222-2222-222222222204','Enrolment workflow','Cohort enrolment, waitlists and invitations.','11111111-1111-1111-1111-111111111103', now() + interval '6 days','medium',false,null),
  ('33333333-3333-3333-3333-333333333316','22222222-2222-2222-2222-222222222204','Progress analytics','Completion rates and learner activity charts.','11111111-1111-1111-1111-111111111104', now() + interval '30 days','low',false,null),
  ('33333333-3333-3333-3333-333333333317','22222222-2222-2222-2222-222222222204','Quiz engine','Question banks, timers and auto-grading.','11111111-1111-1111-1111-111111111102', now() - interval '3 days','medium',true, now() - interval '4 days');

INSERT INTO public.subtasks (task_id, title, is_completed, completed_at) VALUES
  ('33333333-3333-3333-3333-333333333301','Create User model', true, now() - interval '6 days'),
  ('33333333-3333-3333-3333-333333333301','Configure JWT signing', true, now() - interval '4 days'),
  ('33333333-3333-3333-3333-333333333301','Login endpoint', false, null),
  ('33333333-3333-3333-3333-333333333301','Refresh token rotation', false, null),
  ('33333333-3333-3333-3333-333333333302','Elasticsearch index mapping', true, now() - interval '3 days'),
  ('33333333-3333-3333-3333-333333333302','Faceted filter API', false, null),
  ('33333333-3333-3333-3333-333333333302','Cursor pagination', false, null),
  ('33333333-3333-3333-3333-333333333303','Address book component', true, now() - interval '5 days'),
  ('33333333-3333-3333-3333-333333333303','Payment step validation', false, null),
  ('33333333-3333-3333-3333-333333333306','Secure enclave key storage', true, now() - interval '2 days'),
  ('33333333-3333-3333-3333-333333333306','Fallback PIN flow', false, null),
  ('33333333-3333-3333-3333-333333333310','Record versioning schema', false, null),
  ('33333333-3333-3333-3333-333333333310','Audit trail', false, null),
  ('33333333-3333-3333-3333-333333333311','Availability calendar UI', true, now() - interval '1 days'),
  ('33333333-3333-3333-3333-333333333311','Conflict detection rules', false, null),
  ('33333333-3333-3333-3333-333333333314','Lesson drag-and-drop', false, null),
  ('33333333-3333-3333-3333-333333333314','Media upload', false, null);

INSERT INTO public.comments (task_id, author_id, body, created_at) VALUES
  ('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111102','I''ve completed the JWT middleware. Login endpoint is next.', now() - interval '10 minutes'),
  ('33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111101','Great. Please keep refresh token rotation in the same PR.', now() - interval '6 minutes'),
  ('33333333-3333-3333-3333-333333333302','11111111-1111-1111-1111-111111111103','Search latency is at 90ms after the new index mapping.', now() - interval '3 hours'),
  ('33333333-3333-3333-3333-333333333303','11111111-1111-1111-1111-111111111104','Blocked on the payment provider sandbox keys.', now() - interval '1 day'),
  ('33333333-3333-3333-3333-333333333310','11111111-1111-1111-1111-111111111101','This one is overdue — can we get a status update today?', now() - interval '5 hours'),
  ('33333333-3333-3333-3333-333333333311','11111111-1111-1111-1111-111111111105','Calendar UI is done, working on conflict rules now.', now() - interval '2 hours');

INSERT INTO public.activity (project_id, task_id, actor_id, message, created_at) VALUES
  ('22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301','11111111-1111-1111-1111-111111111102','commented on Authentication API', now() - interval '10 minutes'),
  ('22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333305','11111111-1111-1111-1111-111111111102','completed Order history screen', now() - interval '6 days'),
  ('22222222-2222-2222-2222-222222222202','33333333-3333-3333-3333-333333333309','11111111-1111-1111-1111-111111111104','completed Card freeze controls', now() - interval '5 days'),
  ('22222222-2222-2222-2222-222222222203','33333333-3333-3333-3333-333333333310','11111111-1111-1111-1111-111111111101','flagged Patient records module as overdue', now() - interval '5 hours'),
  ('22222222-2222-2222-2222-222222222204','33333333-3333-3333-3333-333333333314','11111111-1111-1111-1111-111111111101','created Course builder', now() - interval '2 days');

INSERT INTO public.notifications (audience, kind, title, body, task_id, project_id, is_read, created_at) VALUES
  ('manager','task_overdue','Task overdue','Patient records module is 8 days past its deadline.','33333333-3333-3333-3333-333333333310','22222222-2222-2222-2222-222222222203', false, now() - interval '5 hours'),
  ('manager','deadline_approaching','Deadline approaching','Product catalogue service is due tomorrow.','33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222201', false, now() - interval '2 hours'),
  ('manager','project_created','Project created','Learning Management System was created.',null,'22222222-2222-2222-2222-222222222204', true, now() - interval '12 days'),
  ('developer','deadline_approaching','Deadline approaching','Biometric login is due in 2 days.','33333333-3333-3333-3333-333333333306','22222222-2222-2222-2222-222222222202', false, now() - interval '1 hours'),
  ('developer','subtask_completed','Subtask completed','Availability calendar UI was marked complete.','33333333-3333-3333-3333-333333333311','22222222-2222-2222-2222-222222222203', true, now() - interval '1 days');