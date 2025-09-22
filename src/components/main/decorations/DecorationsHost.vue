<template>
  <component :is="currentComp" v-if="currentComp" />
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { useAppearanceConfigStore } from '../../../stores/configs/appearanceConfig';
import CircleDecoration from './CircleDecoration.vue';
import FallingStarsDecoration from './FallingStarsDecoration.vue';

const ac = useAppearanceConfigStore();

const registry: Record<string, any> = {
  circle: CircleDecoration,
  fallingStars: FallingStarsDecoration,
};

const currentComp = computed(() => {
  if (ac.decorationType === 'none') return null;
  return registry[ac.decorationType] || null;
});
</script>
