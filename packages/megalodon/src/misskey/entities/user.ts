/// <reference path="emoji.ts" />

namespace MisskeyEntity {
  export type User = {
    id: string
    name: string
    username: string
    createdAt?: string
    followingCount?: number
    followersCount?: number
    notesCount?: number
    host: string | null
    avatarUrl: string
    avatarColor: string
    emojis: Array<Emoji> | { [key: string]: string }
  }
}
