import { invoke } from "@tauri-apps/api/core";

export function admobInit(): Promise<void> {
  return invoke("admob_init");
}

export function admobBannerShow(args: {
  adUnitId: string;
  userId: string;
  safeAreaTop: number;
}): Promise<void> {
  return invoke("admob_banner_show", {
    adUnitId: args.adUnitId,
    userId: args.userId,
    safeAreaTop: args.safeAreaTop,
  });
}

export function admobBannerHide(): Promise<void> {
  return invoke("admob_banner_hide");
}

export function admobBannerIsVisible(): Promise<boolean> {
  return invoke("admob_banner_is_visible");
}
