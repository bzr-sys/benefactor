<script setup lang="ts">
import { computed } from 'vue'
import { initials } from '@/lib/format'

const props = defineProps<{ name: string; size?: number }>()
const text = computed(() => initials(props.name) || '?')
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center rounded-full bg-ink font-bold text-white"
    :style="{
      width: `${size ?? 40}px`,
      height: `${size ?? 40}px`,
      fontSize: `${(size ?? 40) / 3}px`,
    }"
  >
    {{ text }}
  </div>
</template>
