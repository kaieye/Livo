export interface IAvatarResolver {
  resolveFeedAvatar(
    feedUrl: string,
    siteUrl: string,
    incomingImageUrl: string,
    existingImageUrl?: string,
  ): Promise<string>

  fetchInstagramAvatar(username: string): Promise<string>
  fetchYouTubeAvatar(identity: string): Promise<string>
  fetchBilibiliAvatar(uid: string): Promise<string>
}

