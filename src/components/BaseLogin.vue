<script setup lang="ts">
import { bzr } from '@/bazaar'
import BazaarLogoIcon from './BazaarLogoIcon.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="mx-auto flex w-full max-w-[1160px] items-center gap-2 px-4 py-6 sm:px-6">
      <span class="inline-block h-[22px] w-[22px] rounded-md bg-accent"></span>
      <span class="text-xl font-extrabold tracking-tight">Benefactor</span>
    </header>

    <main
      class="mx-auto flex w-full max-w-[1160px] flex-1 flex-col justify-center px-4 py-16 sm:px-6"
    >
      <h1 class="max-w-2xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
        Support the people who make things you love.
      </h1>
      <p class="mt-5 max-w-xl text-lg text-body">
        Join a creator's membership for early work and members-only posts, or follow them for free.
        Creators get paid directly, every month.
      </p>
      <div class="mt-8">
        <button class="btn-primary h-12 px-6 text-base" @click="bzr.login()">
          <BazaarLogoIcon width="20px" /> Continue with Bazaar
        </button>
      </div>
    </main>

    <footer class="border-t border-line py-6 text-sm text-muted">
      <nav class="mx-auto flex max-w-[1160px] flex-wrap gap-4 px-4 sm:px-6">
        <a href="https://bzr.dev/" class="hover:text-ink">Powered by Bazaar</a>
      </nav>
    </footer>
  </div>
</template>
