import { describe, expect, it } from "vitest"
import {
  extractXUsernameFromFeedUrl,
  hasDiscoverSearchQuery,
  parseFollowersFromMirrorText,
} from "./discover-search"

describe("discover-search", () => {
  it("detects whether a discover search query is usable", () => {
    expect(hasDiscoverSearchQuery("")).toBe(false)
    expect(hasDiscoverSearchQuery("   ")).toBe(false)
    expect(hasDiscoverSearchQuery("rsshub")).toBe(true)
  })

  it("extracts x usernames from discover feed urls", () => {
    expect(extractXUsernameFromFeedUrl("https://rsshub.app/twitter/user/ElonMusk")).toBe("elonmusk")
    expect(extractXUsernameFromFeedUrl("rsshub://twitter/user/%40OpenAI")).toBe("openai")
    expect(extractXUsernameFromFeedUrl("https://example.com/feed.xml")).toBeNull()
  })

  it("parses follower counts from mirrored x profile text", () => {
    expect(parseFollowersFromMirrorText("12.3K followers")).toBe("12.3K followers")
    expect(parseFollowersFromMirrorText("followers: 98.5K")).toBe("98.5K followers")
    expect(parseFollowersFromMirrorText("")).toBeUndefined()
  })
})
