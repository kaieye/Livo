import { IAvatarResolver } from './avatar/IAvatarResolver'
import { HttpAvatarResolver } from './avatar/HttpAvatarResolver'
import { PreferenceCachedAvatarResolver } from './avatar/PreferenceCachedAvatarResolver'

export class SocialFeedAvatarService {
  private static resolverInstance: IAvatarResolver =
    new PreferenceCachedAvatarResolver(new HttpAvatarResolver())

  static setResolver(resolver: IAvatarResolver): void {
    SocialFeedAvatarService.resolverInstance = resolver
  }

  static getResolver(): IAvatarResolver {
    return SocialFeedAvatarService.resolverInstance
  }

  static async resolveFeedAvatar(
    feedUrl: string,
    siteUrl: string,
    incomingImageUrl: string,
    existingImageUrl: string = '',
  ): Promise<string> {
    return await SocialFeedAvatarService.resolverInstance.resolveFeedAvatar(
      feedUrl,
      siteUrl,
      incomingImageUrl,
      existingImageUrl,
    )
  }

  static async fetchInstagramAvatar(username: string): Promise<string> {
    return await SocialFeedAvatarService.resolverInstance.fetchInstagramAvatar(username)
  }

  static async fetchYouTubeAvatar(identity: string): Promise<string> {
    return await SocialFeedAvatarService.resolverInstance.fetchYouTubeAvatar(identity)
  }

  static async fetchBilibiliAvatar(uid: string): Promise<string> {
    return await SocialFeedAvatarService.resolverInstance.fetchBilibiliAvatar(uid)
  }
}
