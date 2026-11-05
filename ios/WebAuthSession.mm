#import <AuthenticationServices/AuthenticationServices.h>
#import <React/RCTUtils.h>
#import <WebAuthSessionSpec/WebAuthSessionSpec.h>

@interface WebAuthSession : NSObject <NativeWebAuthSessionSpec, ASWebAuthenticationPresentationContextProviding>
@end

@implementation WebAuthSession {
  ASWebAuthenticationSession *_session; // Only touched on the main queue.
}

+ (NSString *)moduleName
{
  return @"WebAuthSession";
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeWebAuthSessionSpecJSI>(params);
}

- (void)openAuthSession:(NSString *)url
          callbackScheme:(NSString *)callbackScheme
  preferEphemeralSession:(BOOL)preferEphemeralSession
         browserPackages:(NSArray *)browserPackages
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  if (_session) {
    return reject(@"ALREADY_OPEN", @"Another auth session is open", nil);
  }
  NSURL *URL = [NSURL URLWithString:url];
  if (!URL) {
    return reject(@"OPEN_FAILED", @"Invalid URL", nil);
  }
  // Settle once, whether start fails, the completion handler runs, or both.
  __block BOOL settled = NO;
  ASWebAuthenticationSession *session = [[ASWebAuthenticationSession alloc]
            initWithURL:URL
      callbackURLScheme:callbackScheme
      completionHandler:^(NSURL *callbackURL, NSError *error) {
        if (settled) return;
        settled = YES;
        self->_session = nil;
        if (callbackURL) {
          resolve(callbackURL.absoluteString);
        } else if (error.code == ASWebAuthenticationSessionErrorCodeCanceledLogin) {
          resolve(nil);
        } else {
          reject(@"OPEN_FAILED", error.localizedDescription, error);
        }
      }];
  session.presentationContextProvider = self;
  session.prefersEphemeralWebBrowserSession = preferEphemeralSession;
  _session = session;
  if (![session start] && !settled) {
    settled = YES;
    _session = nil;
    reject(@"OPEN_FAILED", @"The auth session did not start", nil);
  }
}

- (ASPresentationAnchor)presentationAnchorForWebAuthenticationSession:(ASWebAuthenticationSession *)session
{
  return RCTKeyWindow();
}

@end
