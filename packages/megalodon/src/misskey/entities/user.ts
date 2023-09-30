/// <reference path="emoji.ts" />

namespace MisskeyEntity {
  export type User = {
    id: string
    name: string
    username: string
    createdAt?: string
    description?: string
    followingCount?: number
    followersCount?: number
    notesCount?: number
    host: string | null
    avatarUrl: string
    uri?: string
    bannerUrl?: string | null
    avatarColor: string
    emojis: Array<Emoji> | { [key: string]: string }
  }
}
