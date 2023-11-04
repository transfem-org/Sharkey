<template>
	<MkContainer :foldable="true">
		<template #header
			><i
				class="ph-headphones ph-bold ph-lg"
				style="margin-right: 0.5em"
			></i
			>Music</template
		>

		<div style="padding: 8px">
			<div class="flex">
				<a :href="listenbrainz.musicbrainzurl">
					<img class="image" :src="listenbrainz.img" :alt="listenbrainz.title" />
					<div class="flex flex-col items-start">
						<p class="text-sm font-bold">Now Playing: {{ listenbrainz.title }}</p>
						<p class="text-xs font-medium">{{ listenbrainz.artist }}</p>
					</div>
				</a>
				<a :href="listenbrainz.listenbrainzurl">
					<div class="playicon">
						<i class="ph-play ph-bold ph-lg-filled"></i>
					</div>
				</a>
			</div>
		</div>
	</MkContainer>
</template>

<script lang="ts" setup>
/* eslint-disable no-mixed-spaces-and-tabs */
import {} from "vue";
import * as misskey from "misskey-js";
import MkContainer from "@/components/MkContainer.vue";
const props = withDefaults(
	defineProps<{
		user: misskey.entities.User;
	}>(),
	{},
);
const listenbrainz = { title: '', artist: '', lastlisten: '', img: '', musicbrainzurl: '', listenbrainzurl: '' };
if (props.user.listenbrainz) {
	const getLMData = async (title: string, artist: string) => {
		const response = await fetch(`https://api.listenbrainz.org/1/metadata/lookup/?artist_name=${artist}&recording_name=${title}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			},
		});
		const data = await response.json();
		if (!data.recording_name) {
		return null;
		}
		const titler: string = data.recording_name;
		const artistr: string = data.artist_credit_name;
		const img: string = data.release_mbid ? `https://coverartarchive.org/release/${data.release_mbid}/front-250` : 'https://coverartarchive.org/img/big_logo.svg';
		const musicbrainzurl: string = data.recording_mbid ? `https://musicbrainz.org/recording/${data.recording_mbid}` : '#';
		const listenbrainzurl: string = data.recording_mbid ? `https://listenbrainz.org/player?recording_mbids=${data.recording_mbid}` : '#';
		return [titler, artistr, img, musicbrainzurl, listenbrainzurl];
	};
	const response = await fetch(`https://api.listenbrainz.org/1/user/${props.user.listenbrainz}/playing-now`, {
        method: 'GET',
        headers: {
			'Content-Type': 'application/json'
        },
    });
    const data = await response.json();
	if (data.payload.listens && data.payload.listens.length !== 0) {
      const title: string = data.payload.listens[0].track_metadata.track_name;
      const artist: string = data.payload.listens[0].track_metadata.artist_name;
      const lastlisten: string = data.payload.listens[0].playing_now;
      const img: string = 'https://coverartarchive.org/img/big_logo.svg';
      await getLMData(title, artist).then((data) => {
        if (!data) {
          listenbrainz.title = title;
		  listenbrainz.img = img;
		  listenbrainz.artist = artist;
		  listenbrainz.lastlisten = lastlisten;
		  return;
        } else {
          listenbrainz.title = data[0];
		  listenbrainz.img = data[2];
		  listenbrainz.artist = data[1];
		  listenbrainz.lastlisten = lastlisten;
		  listenbrainz.musicbrainzurl = data[3];
		  listenbrainz.listenbrainzurl = data[4];
          return;
        }
      });
    }
}
</script>

<style lang="scss" scoped>
.flex {
	display: flex;
	align-items: center;
}
.flex a {
  display: flex;
  align-items: center;
  text-decoration: none;
}
.image {
	height: 4.8rem;
	margin-right: 0.7rem;
}
.items-start {
	align-items: flex-start;
}
.flex-col {
	display: flex;
	flex-direction: column;
}
.text-sm {
	font-size: 0.875rem;
	margin: 0;
	margin-bottom: 0.3rem;
}
.font-bold {
	font-weight: 700;
}
.text-xs {
	font-size: 0.75rem;
	margin: 0;
}
.font-medium {
	font-weight: 500;
}
.playicon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 3rem;
	height: 3rem;
	font-size: 1.7rem;
	padding-left: 3rem;
}
</style>
