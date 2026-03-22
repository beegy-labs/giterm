#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialize Google Mobile Ads SDK.
 * Must be called once before any ad requests.
 */
void admob_sdk_init(void);

/**
 * Show a banner ad at the top of the screen (below safe-area).
 *
 * @param ad_unit_id   AdMob banner ad unit ID (UTF-8 C string)
 * @param user_id      Stable per-install UUID for frequency capping (UTF-8 C string)
 * @param wk_webview   Raw pointer to the WKWebView (used to get window)
 * @param safe_area_top Safe area top inset in points
 */
void admob_show_banner(const char *ad_unit_id, const char *user_id, void *wk_webview, double safe_area_top);

/**
 * Hide and destroy the currently shown banner.
 */
void admob_hide_banner(void);

/**
 * Returns 1 if a banner is currently displayed, 0 otherwise.
 */
int admob_is_banner_visible(void);

#ifdef __cplusplus
}
#endif
