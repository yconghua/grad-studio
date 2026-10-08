<template>
  <div ref="barRef" class="tabbar" @wheel="onWheel">
    <!-- 固定标签（本角色工作台）：恒在最前，不参与拖拽、不显示关闭按钮 -->
    <div
      v-for="tab in pinnedTabs"
      :key="tab.key"
      class="tab-item is-pinned"
      :class="{ 'is-active': tab.key === displayActiveKey }"
      :title="tab.title"
      @click="clickTab(tab)"
    >
      <span class="tab-title">{{ tab.title }}</span>
    </div>

    <!-- 可拖标签：vuedraggable 负责拖拽排序，顺序变化后写回 useTabs -->
    <draggable
      v-model="dragList"
      item-key="key"
      class="tab-draggable"
      @end="onDragEnd"
    >
      <template #item="{ element }">
        <div
          class="tab-item"
          :class="{ 'is-active': element.key === displayActiveKey }"
          :title="element.title"
          @click="clickTab(element)"
          @mousedown="onMousedown($event, element)"
        >
          <span class="tab-title">{{ element.title }}</span>
          <button
            v-if="!element.pinned"
            type="button"
            class="tab-close"
            title="关闭标签"
            @click.stop="onClose($event, element)"
          >
            <CloseOutlined />
          </button>
        </div>
      </template>
    </draggable>
  </div>
</template>

<script setup>
// 标签栏组件：浏览器风格的多标签页
// - 固定标签（工作台）单独渲染在可拖列表外 → 天然不可拖、恒在最前
// - 可拖标签放 vuedraggable 内，拖拽结束把新顺序写回 useTabs 并持久化
// - 宽度自适应：标签多时 flex 收缩（150px → 64px）；达到上限（useTabs.MAX_TABS）
//   时自动关闭最先打开的标签，不出现横向滚动条（overflow-x hidden 兜底裁切）
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useTabs } from '../../composables/useTabs'
import { useSession } from '../../composables/useSession'
import { SUPER_ADMIN_HOME } from '../../config/nav/super-admin'
import { GROUP_ADMIN_HOME } from '../../config/nav/group-admin'
import { MENTOR_HOME } from '../../config/nav/mentor'
import { STUDENT_HOME } from '../../config/nav/student'
import { ROLE_SUPER_ADMIN, ROLE_GROUP_ADMIN, ROLE_MENTOR, ROLE_STUDENT } from '../../config/constants'

const router = useRouter()
const { tabs, activeKey, closeTab, reorder, ensureHomeTab } = useTabs()
const { getSessionUser } = useSession()

// 当前角色工作台路径与路由前缀：标签渲染按角色兜底过滤，
// 即使状态里残留其它账号/角色的标签也不显示（切换账号后不串台）
const HOME_BY_ROLE = {
  [ROLE_SUPER_ADMIN]: SUPER_ADMIN_HOME,
  [ROLE_GROUP_ADMIN]: GROUP_ADMIN_HOME,
  [ROLE_MENTOR]: MENTOR_HOME,
  [ROLE_STUDENT]: STUDENT_HOME
}
const homePath = computed(() => {
  const u = getSessionUser()
  return (u && HOME_BY_ROLE[u.role]) || ''
})
const rolePrefix = computed(() => {
  const h = homePath.value
  if (!h) return ''
  const seg = String(h).split('/')[1] || ''
  return '/' + seg + '/'
})

// 标签栏容器引用：用于滚轮横向滚动与激活标签滚动到可见
const barRef = ref(null)

// 挂载时强制确保固定工作台标签存在（内部先恢复上次会话的标签再兜底工作台），
// 不依赖路由钩子时序，避免任何异常状态下标签栏空置
ensureHomeTab()

// 固定标签只展示当前角色的工作台（其它角色残留的 pinned 标签不渲染）
const pinnedTabs = computed(() => tabs.value.filter((t) => t.pinned && t.key === homePath.value))

// 激活态兜底：若激活 key 不在当前展示的标签内（切换账号后残留的旧角色标签），
// 高亮回落到当前角色工作台，避免标签栏无激活项
const displayActiveKey = computed(() => {
  const shown = new Set([...pinnedTabs.value, ...dragList.value].map((t) => t.key))
  return shown.has(activeKey.value) ? activeKey.value : homePath.value
})

// 可拖标签列表：vuedraggable 直接操作本数组，tabs 增删时同步回来；
// 只同步当前角色路由前缀下的业务标签，跨角色残留标签不进入拖拽列表
const dragList = ref([])
watch(
  tabs,
  () => {
    const prefix = rolePrefix.value
    dragList.value = tabs.value.filter((t) => !t.pinned && (!prefix || t.key.startsWith(prefix)))
  },
  { deep: true, immediate: true }
)

function clickTab(tab) {
  if (tab.key !== activeKey.value) router.push(tab.path)
}

function onClose(e, tab) {
  e.stopPropagation()
  closeTab(tab.key)
}

// 中键点击关闭标签（浏览器习惯）；preventDefault 阻止 Windows 中键自动滚动
function onMousedown(e, tab) {
  if (e.button === 1) {
    e.preventDefault()
    closeTab(tab.key)
  }
}

function onDragEnd() {
  reorder(dragList.value)
}

// 滚轮横向滚动：标签溢出时，上下/左右滚动都转为标签行横向滑动；
// 未溢出时不做拦截，保持页面原有滚动行为
function onWheel(e) {
  const el = barRef.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    el.scrollLeft += e.deltaX
  } else {
    el.scrollLeft += e.deltaY
  }
  e.preventDefault()
}

// 激活标签变化时（打开新标签 / 恢复会话 / 点击切换）滚动到可见位置
watch(
  activeKey,
  async () => {
    await nextTick()
    const el = barRef.value && barRef.value.querySelector('.tab-item.is-active')
    if (el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  },
  { immediate: true }
)
</script>

<style scoped>
.tabbar {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  overflow-x: hidden;
  overflow-y: hidden;
}
.tab-draggable {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  height: 100%;
}
.tab-item {
  flex: 0 1 150px;
  min-width: 64px;
  max-width: 150px;
  height: 26px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px 0 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  box-sizing: border-box;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
  user-select: none;
}
.tab-item.is-pinned {
  /* 固定标签（工作台）宽度随内容，不撑满 150px 基础宽度 */
  flex: 0 0 auto;
}
.tab-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.tab-item.is-active {
  /* 激活标签不收缩，宽度随标题内容，完整可读 */
  flex: 0 0 auto;
  max-width: 200px;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.tab-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
  padding: 0;
}
.tab-close:hover {
  background: var(--border-strong);
  color: var(--text);
}
/* sortablejs 拖拽过程样式（克隆元素在 scoped 外，用 :deep 命中） */
:deep(.sortable-ghost) {
  opacity: 0.4;
}
:deep(.sortable-drag) {
  opacity: 0.9;
  box-shadow: var(--shadow-md);
}
:deep(.sortable-placeholder) {
  border: 1px dashed var(--border-strong);
  background: transparent;
}
</style>
