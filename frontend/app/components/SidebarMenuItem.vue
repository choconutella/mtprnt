<script setup lang="ts">
import type { NavigationItem } from "~/data/navigation";

const props = withDefaults(
  defineProps<{ item: NavigationItem; depth?: number }>(),
  { depth: 0 },
);
const route = useRoute();
const emit = defineEmits<{ logout: [] }>();
const hasChildren = computed(() => Boolean(props.item.children?.length));
const isActive = computed(() =>
  Boolean(props.item.to && route.path === props.item.to),
);
const containsActive = computed(() =>
  Boolean(
    props.item.children?.some(
      (child) =>
        child.to === route.path ||
        child.children?.some((nested) => nested.to === route.path),
    ),
  ),
);
const isOpen = ref(containsActive.value);

function handleClick() {
  if (hasChildren.value) isOpen.value = !isOpen.value;
  if (props.item.action === "logout") emit("logout");
}
</script>

<template>
  <div class="space-y-1">
    <UButton
      v-if="hasChildren || item.action"
      block
      color="neutral"
      variant="ghost"
      :icon="item.icon"
      :label="item.label"
      :trailing-icon="
        hasChildren
          ? isOpen
            ? 'i-lucide-chevron-down'
            : 'i-lucide-chevron-right'
          : undefined
      "
      class="justify-start text-dimmed hover:text-highlighted"
      :class="[
        containsActive && 'bg-primary/10 text-primary',
        depth > 0 && 'text-sm',
      ]"
      :ui="{ trailingIcon: 'ms-auto' }"
      @click="handleClick"
    />
    <NuxtLink
      v-else
      :to="item.to!"
      class="block"
    >
      <UButton
        block
        color="neutral"
        variant="ghost"
        :icon="item.icon"
        :label="item.label"
        class="justify-start"
        :class="[
          isActive
            ? 'bg-primary/15 text-primary font-semibold'
            : 'text-dimmed hover:text-highlighted',
          depth > 0 && 'text-sm',
        ]"
      />
    </NuxtLink>
    <div
      v-if="hasChildren && isOpen"
      class="ms-3 space-y-1 border-s border-default ps-2"
    >
      <SidebarMenuItem
        v-for="child in item.children"
        :key="child.label"
        :item="child"
        :depth="depth + 1"
        @logout="emit('logout')"
      />
    </div>
  </div>
</template>
