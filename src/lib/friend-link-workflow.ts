export type FriendLinkFormValues = {
  readonly description: string;
  readonly isVisible: boolean;
  readonly logoUrl: string;
  readonly name: string;
  readonly sortOrder: string;
  readonly url: string;
};

export type FriendSettingsFormValues = {
  readonly friendsContactLabel: string;
  readonly friendsContactUrl: string;
  readonly friendsEnabled: boolean;
  readonly friendsIntro: string;
  readonly friendsRequirements: string;
};

export type FriendLinkMutationState =
  | { readonly revision: number; readonly status: "idle" }
  | {
    readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
    readonly message: string;
    readonly revision: number;
    readonly status: "error";
    readonly values: FriendLinkFormValues;
  };

export type FriendSettingsMutationState =
  | { readonly revision: number; readonly status: "idle" }
  | {
    readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
    readonly message: string;
    readonly revision: number;
    readonly status: "error";
    readonly values: FriendSettingsFormValues;
  }
  | {
    readonly revision: number;
    readonly status: "success";
    readonly values: FriendSettingsFormValues;
  };

export type FriendLinkRowActionState =
  | { readonly status: "idle" }
  | { readonly message: string; readonly status: "error" };

export const INITIAL_FRIEND_LINK_MUTATION_STATE: FriendLinkMutationState = {
  revision: 0,
  status: "idle",
};

export const INITIAL_FRIEND_SETTINGS_MUTATION_STATE: FriendSettingsMutationState = {
  revision: 0,
  status: "idle",
};

export const INITIAL_FRIEND_LINK_ROW_ACTION_STATE: FriendLinkRowActionState = {
  status: "idle",
};
