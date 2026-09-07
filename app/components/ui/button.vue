<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '~/lib/utils'

defineProps<ButtonProps>()

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    defaultVariants: { size: 'default', variant: 'default' },
    variants: {
      size: {
        default: 'h-12 px-6 py-2',
        icon: 'h-10 w-10',
        lg: 'h-12 px-8',
        sm: 'h-9 px-4 text-[13px]',
      },
      variant: {
        accentLilac: 'bg-secondary text-secondary-foreground hover:bg-[#b86ef0]',
        accentOrange: 'bg-accent text-accent-foreground hover:bg-[#e6a71e]',
        default: 'bg-primary text-primary-foreground hover:bg-[#1147B8] shadow-sm',
        ghost: 'hover:bg-muted hover:text-foreground',
        inverse: 'bg-inverse-surface text-inverse-on-surface hover:bg-black',
        link: 'text-primary underline-offset-4 hover:underline',
        secondary: 'bg-background text-foreground border border-border hover:bg-muted',
      },
    },
  },
)

type ButtonProps = VariantProps<typeof buttonVariants> & {
  class?: HTMLAttributes['class']
}
</script>

<template>
  <button :class="cn(buttonVariants({ variant, size }), $props.class)">
    <slot />
  </button>
</template>
