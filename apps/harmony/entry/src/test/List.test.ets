import localUnitTest from './LocalUnit.test';
import feedChangeSignalTest from './FeedChangeSignal.test';
import homeReloadPolicyTest from './HomeReloadPolicy.test';

export default function testsuite() {
  localUnitTest();
  feedChangeSignalTest();
  homeReloadPolicyTest();
}
