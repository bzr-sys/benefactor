<script setup lang="ts">
import { formatPrice } from '@/lib/format'
import type { Tier } from '@/lib/posts'

defineProps<{
  tier: Tier
  highlight?: boolean
  current?: boolean
  /** The viewer has another tier on this page */
  switching?: boolean
  disabled?: boolean
}>()
defineEmits<{ join: [] }>()
</script>

<template>
  <div
    class="rounded-[14px] bg-white"
    :class="highlight || current ? 'border-2 border-accent p-[19px]' : 'border border-line p-5'"
  >
    <div class="flex items-baseline justify-between gap-3">
      <strong class="text-[17px]">{{ tier.name }}</strong>
      <span class="whitespace-nowrap">
        <strong class="text-xl">{{ formatPrice(tier.costInCents) }}</strong>
        <span class="text-muted"> /mo</span>
      </span>
    </div>
    <p v-if="tier.description" class="mb-3.5 mt-2 whitespace-pre-line text-[15px] text-body">
      {{ tier.description }}
    </p>
    <div v-else class="h-3.5"></div>
    <div
      v-if="current"
      class="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-paper font-semibold"
    >
      Your tier
    </div>
    <button
      v-else
      class="w-full"
      :class="highlight ? 'btn-primary' : 'btn-secondary'"
      :disabled="disabled"
      @click="$emit('join')"
    >
      {{ switching ? 'Switch to this tier' : 'Join' }}
    </button>
  </div>
</template>
