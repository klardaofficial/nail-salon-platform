export type AdminIdentity = {
  id: string;
  email: string;
  displayName: string | null;
  mustChangePassword: boolean;
  isSystemAdmin: boolean;
  organizationIds: string[];
};
