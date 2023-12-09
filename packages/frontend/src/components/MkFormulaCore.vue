<template>
	<div v-if="block" v-html="compiledFormula"></div>
	<span v-else v-html="compiledFormula"></span>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import katex from "katex";

export default defineComponent({
	props: {
		formula: {
			type: String,
			required: true,
		},
		block: {
			type: Boolean,
			required: true,
		},
	},
	computed: {
		compiledFormula(): any {
			const katexString = katex.renderToString(this.formula, {
				throwOnError: false,
			} as any);
			return this.block
				? `<div style="text-align:center">${katexString}</div>`
				: katexString;
		},
	},
});
</script>

<style>
@import "../../node_modules/katex/dist/katex.min.css";
</style>
