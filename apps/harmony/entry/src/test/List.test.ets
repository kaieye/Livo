import localUnitTest from './LocalUnit.test';
import feedChangeSignalTest from './FeedChangeSignal.test';
import rootTabVisibilityPolicyTest from './RootTabVisibilityPolicy.test';
import discoverAvatarPresentationTest from './DiscoverAvatarPresentation.test';
import discoverBrowsePaginationTest from './DiscoverBrowsePagination.test';
import rssFeedServiceSupportTest from './RssFeedServiceSupport.test';
import homeFeedStateBagTest from './HomeFeedStateBag.test';

export default function testsuite() {
  localUnitTest();
  feedChangeSignalTest();
  rootTabVisibilityPolicyTest();
  discoverAvatarPresentationTest();
  discoverBrowsePaginationTest();
  rssFeedServiceSupportTest();
  homeFeedStateBagTest();
}
