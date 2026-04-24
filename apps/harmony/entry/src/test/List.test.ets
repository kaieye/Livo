import localUnitTest from './LocalUnit.test';
import feedChangeSignalTest from './FeedChangeSignal.test';
import homeReloadPolicyTest from './HomeReloadPolicy.test';
import rootTabVisibilityPolicyTest from './RootTabVisibilityPolicy.test';

export default function testsuite() {
  localUnitTest();
  feedChangeSignalTest();
  homeReloadPolicyTest();
  rootTabVisibilityPolicyTest();
}
