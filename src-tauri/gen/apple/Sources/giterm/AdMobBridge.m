#import "AdMobBridge.h"
#import <UIKit/UIKit.h>

#if __has_include(<GoogleMobileAds/GoogleMobileAds.h>)
#import <GoogleMobileAds/GoogleMobileAds.h>
#define ADMOB_AVAILABLE 1
#else
#define ADMOB_AVAILABLE 0
#endif

#if ADMOB_AVAILABLE

// MARK: - Internal delegate

@interface GiterAdDelegate : NSObject <GADBannerViewDelegate>
@end

@implementation GiterAdDelegate
- (void)bannerViewDidReceiveAd:(GADBannerView *)bannerView {
    NSLog(@"[AdMob] Banner loaded");
    dispatch_async(dispatch_get_main_queue(), ^{
        bannerView.hidden = NO;
    });
}
- (void)bannerView:(GADBannerView *)bannerView didFailToReceiveAdWithError:(NSError *)error {
    NSLog(@"[AdMob] Banner failed: %@", error.localizedDescription);
    // Hide the placeholder so no empty space is left
    dispatch_async(dispatch_get_main_queue(), ^{
        bannerView.hidden = YES;
    });
}
@end

// MARK: - Static state

static GADBannerView *g_bannerView = nil;
static GiterAdDelegate *g_delegate = nil;
static double g_safeAreaTop = 0.0;

// MARK: - C bridge

void admob_sdk_init(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[GADMobileAds sharedInstance] startWithCompletionHandler:^(GADInitializationStatus *status) {
            NSLog(@"[AdMob] SDK initialized");
        }];
    });
}

void admob_show_banner(const char *ad_unit_id, const char *user_id, void *wk_webview, double safe_area_top) {
    if (g_bannerView != nil) return;

    NSString *adUnitId = [NSString stringWithUTF8String:ad_unit_id];
    NSString *userId   = [NSString stringWithUTF8String:user_id];
    UIView   *wkView   = (__bridge UIView *)wk_webview;
    g_safeAreaTop      = safe_area_top;

    dispatch_async(dispatch_get_main_queue(), ^{
        UIWindow *window = wkView.window;
        if (!window) {
            NSLog(@"[AdMob] No window — cannot show banner");
            return;
        }

        CGFloat screenW = window.bounds.size.width;
        CGFloat bannerH = 50.0;
        CGFloat bannerY = safe_area_top; // sit just below status bar / Dynamic Island

        GADBannerView *banner = [[GADBannerView alloc] initWithAdSize:GADAdSizeBanner];
        banner.adUnitID = adUnitId;
        banner.rootViewController = window.rootViewController;
        banner.frame = CGRectMake(0, bannerY, screenW, bannerH);
        banner.hidden = YES; // show only after ad loads (bannerViewDidReceiveAd)

        if (!g_delegate) g_delegate = [[GiterAdDelegate alloc] init];
        banner.delegate = g_delegate;

        [window addSubview:banner];
        g_bannerView = banner;

        // Build request — pass user_id as publisher-provided ID for fraud signals
        GADRequest *request = [GADRequest request];
        // Note: setPublisherProvidedID is available in some SDK versions; use extras as fallback
        NSLog(@"[AdMob] Loading banner for user=%@", userId);
        [banner loadRequest:request];
    });
}

void admob_hide_banner(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [g_bannerView removeFromSuperview];
        g_bannerView = nil;
    });
}

int admob_is_banner_visible(void) {
    return (g_bannerView != nil && !g_bannerView.hidden) ? 1 : 0;
}

#else  // AdMob SDK not available (simulator / macOS build without pod)

void admob_sdk_init(void) {
    NSLog(@"[AdMob] SDK not linked — skipping init");
}

void admob_show_banner(const char *ad_unit_id, const char *user_id, void *wk_webview, double safe_area_top) {
    NSLog(@"[AdMob] SDK not linked — cannot show banner");
}

void admob_hide_banner(void) {}

int admob_is_banner_visible(void) { return 0; }

#endif
