import localUnitTest from './LocalUnit.test';
import feedChangeSignalTest from './FeedChangeSignal.test';
import homeReloadPolicyTest from './HomeReloadPolicy.test';
import rootTabVisibilityPolicyTest from './RootTabVisibilityPolicy.test';
import discoverAvatarPresentationTest from './DiscoverAvatarPresentation.test';
import discoverBrowsePaginationTest from './DiscoverBrowsePagination.test';
import rssFeedServiceSupportTest from './RssFeedServiceSupport.test';

export default function testsuite() {
  localUnitTest();
  feedChangeSignalTest();
  homeReloadPolicyTest();
  rootTabVisibilityPolicyTest();
  discoverAvatarPresentationTest();
  discoverBrowsePaginationTest();
  rssFeedServiceSupportTest();
}
