export interface MemberDetailSheetProps {
  memberId: string | null;
  projectId?: string;
  projectName?: string;
  fromHref?: string;
  onClose: () => void;
}
