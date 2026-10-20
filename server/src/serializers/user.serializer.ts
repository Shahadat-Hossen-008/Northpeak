export interface SerializedAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified?: boolean;
}

export interface SerializedUserProfile extends SerializedAuthUser {
  createdAt?: string | Date;
}

export function serializeAuthUser(user: {
  _id?: any;
  id?: any;
  name: string;
  email: string;
  role: string;
  emailVerified?: boolean;
}): SerializedAuthUser {
  const id = user._id ? user._id.toString() : user.id ? user.id.toString() : "";
  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified !== false,
  };
}

export function serializeUserProfile(user: {
  _id?: any;
  id?: any;
  name: string;
  email: string;
  role: string;
  emailVerified?: boolean;
  createdAt?: Date;
}): SerializedUserProfile {
  const base = serializeAuthUser(user);
  return {
    ...base,
    createdAt: user.createdAt,
  };
}
