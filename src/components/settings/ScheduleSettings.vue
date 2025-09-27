<template>
  <v-container>
    <v-card flat class="pa-2">
      <v-card-text>
        <!-- 中文注释：心跳与基础配置 -->
        <div class="mb-10">
          <div class="d-flex justify-space-between align-center mb-3">
            <div class="d-flex align-center">
              <h2 class="text-h6 font-weight-bold mb-0 mr-3">调度心跳</h2>
              <v-chip :color="heartbeatSwitch ? 'green' : 'grey'" size="small" variant="flat">
                {{ heartbeatSwitch ? '运行中' : '已停止' }}
              </v-chip>
            </div>
            <v-switch v-model="heartbeatSwitch" inset hide-details color="primary"
              :label="heartbeatSwitch ? '点击关闭' : '点击开启'"></v-switch>
          </div>
          <p class="text-caption text-medium-emphasis mb-6">调度心跳会周期性检查并执行到期任务。关闭后任务不再自动执行。</p>

          <v-row>
            <v-col cols="12" md="9">
              <div class="d-flex justify-space-between align-center mb-1">
                <v-label>心跳间隔 (毫秒)</v-label>
                <span class="text-primary font-weight-medium">{{ schedule.heartbeatIntervalMs }}</span>
              </div>
              <v-slider v-model="schedule.heartbeatIntervalMs" :min="1000" :max="600000" :step="1000" thumb-label
                color="primary" @end="onIntervalSliderEnd"></v-slider>
              <div class="text-caption text-medium-emphasis mt-n2">范围 1秒 ~ 10分钟，推荐 10s~60s。</div>
            </v-col>
            <v-col cols="12" md="3" class="d-flex flex-column justify-end">
              <v-btn block variant="tonal" color="secondary" @click="resetInterval"
                :disabled="schedule.heartbeatIntervalMs === defaultInterval">重置默认</v-btn>
            </v-col>
          </v-row>
        </div>

        <v-divider class="my-10" />

        <!-- 中文注释：任务统计 -->
        <div class="mb-10">
          <div class="d-flex justify-space-between align-center mb-3">
            <h2 class="text-h6 font-weight-bold mb-0">任务统计</h2>
            <v-btn size="small" variant="text" @click="refreshStats">刷新</v-btn>
          </div>
          <v-row dense>
            <v-col v-for="stat in statsArr" :key="stat.key" cols="6" md="3">
              <v-card variant="tonal" :color="stat.color" class="pa-3">
                <div class="text-caption text-medium-emphasis">{{ stat.label }}</div>
                <div class="text-h6 font-weight-bold">{{ stat.value }}</div>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <v-divider class="my-10" />

        <!-- 中文注释：任务列表（从 ChatHistoryPage 迁移） -->
        <div>
          <div class="d-flex justify-space-between align-center mb-3">
            <h2 class="text-h6 font-weight-bold mb-0 d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-calendar-clock</v-icon>
              计划任务
            </h2>
            <v-chip size="small" color="grey-lighten-2" variant="elevated">共 {{ tasks.length }} 个</v-chip>
          </div>
          <v-card class="schedule-card" rounded="xl" variant="flat">
            <v-divider />
            <v-card-text class="py-0">
              <div v-if="tasks.length === 0" class="text-center py-6 text-grey">
                <v-icon size="28" color="grey-lighten-1" class="mb-2">mdi-timetable</v-icon>
                暂无计划任务
              </div>
              <v-list v-else density="comfortable">
                <v-list-item v-for="t in sortedTasks" :key="t.id" class="px-2 py-1 schedule-item">
                  <template #prepend>
                    <v-avatar size="28" class="mr-2" :class="statusAvatarClass(t.status)">
                      <v-icon size="18">{{ statusIcon(t.status) }}</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="text-body-2 font-weight-medium">{{ t.content.title
                  }}</v-list-item-title>
                  <v-list-item-subtitle class="text-caption text-grey-darken-1 schedule-subtitle">
                    <span class="meta">状态：</span>
                    <v-chip size="x-small" :color="statusColor(t.status)" variant="flat" class="status-chip">{{
                      statusLabel(t.status)
                    }}</v-chip>
                    <span class="meta">计划：{{ fmtTime(t.scheduledAt) }}</span>
                    <span v-if="t.outdatedAt" class="meta">过期：{{ fmtTime(t.outdatedAt) }}</span>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-btn icon size="small" variant="text" color="error" :aria-label="taskActionLabel(t)"
                      @click="handleTaskAction(t)">
                      <v-icon size="18">{{ taskActionIcon(t) }}</v-icon>
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </div>

      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
// 中文注释：导入需要的依赖
import { computed, ref, watchEffect } from 'vue'
import { useScheduleStore, type ScheduleTask } from '../../stores/schedule'

// 中文注释：Pinia store 实例
const schedule = useScheduleStore()

// 中文注释：默认间隔（初始值）
const defaultInterval = schedule.heartbeatIntervalMs

// 中文注释：心跳启停 switch 的 computed 封装
const heartbeatSwitch = computed<boolean>({
  get: () => schedule.getHeartbeatOn,
  set: (val: boolean) => {
    schedule.setHeartbeatOn(val)
    console.log('Heartbeat switched to', val)
  },
})

// 中文注释：滑动结束时应用并重启心跳（若运行中）
function onIntervalSliderEnd() {
  schedule.setHeartbeatInterval(schedule.heartbeatIntervalMs)
}

// 中文注释：重置为默认值并重启（若运行中）
function resetInterval() {
  schedule.setHeartbeatInterval(defaultInterval)
}

// 中文注释：任务统计（调用 store 私有方法不太优雅，此处复制一次统计逻辑）
function buildStats() {
  const arr = schedule.tasks
  const counts: Record<string, number> = {
    scheduled: 0,
    pending: 0,
    running: 0,
    outdated: 0,
    accomplished: 0,
    canceled: 0,
    total: arr.length,
  }
  for (const t of arr) counts[t.status]++
  return counts
}

const stats = ref(buildStats())
function refreshStats() { stats.value = buildStats() }
// 中文注释：任务变化时自动刷新统计
watchEffect(() => { schedule.tasks.length; stats.value = buildStats() })

const statsArr = computed(() => [
  { key: 'scheduled', label: '已计划', value: stats.value.scheduled, color: 'primary' },
  { key: 'pending', label: '待执行', value: stats.value.pending, color: 'indigo' },
  { key: 'running', label: '运行中', value: stats.value.running, color: 'cyan' },
  { key: 'outdated', label: '已过期', value: stats.value.outdated, color: 'orange' },
  { key: 'accomplished', label: '完成', value: stats.value.accomplished, color: 'green' },
  { key: 'canceled', label: '取消', value: stats.value.canceled, color: 'grey' },
  { key: 'total', label: '总数', value: stats.value.total, color: 'purple' },
])

// ================= 迁移自 ChatHistoryPage 的任务展示逻辑 =================
const tasks = computed(() => schedule.tasks)
const sortedTasks = computed(() => {
  const order: Record<ScheduleTask['status'], number> = {
    running: 0,
    outdated: 1,
    pending: 2,
    scheduled: 3,
    accomplished: 4,
    canceled: 5,
  }
  return [...tasks.value].sort((a, b) => {
    const byStatus = order[a.status] - order[b.status]
    if (byStatus !== 0) return byStatus
    const ta = a.startedAt ?? a.scheduledAt ?? a.createdAt
    const tb = b.startedAt ?? b.scheduledAt ?? b.createdAt
    return tb - ta
  })
})

function two(n: number) { return n < 10 ? `0${n}` : `${n}` }
function fmtTime(ts?: number) {
  if (!ts) return '—'
  const d = new Date(ts)
  const Y = d.getFullYear()
  const M = two(d.getMonth() + 1)
  const D = two(d.getDate())
  const h = two(d.getHours())
  const m = two(d.getMinutes())
  return `${Y}-${M}-${D} ${h}:${m}`
}

function statusLabel(s: ScheduleTask['status']) {
  switch (s) {
    case 'scheduled': return '已计划'
    case 'pending': return '排队中'
    case 'running': return '执行中'
    case 'outdated': return '已过期'
    case 'accomplished': return '已完成'
    case 'canceled': return '已取消'
  }
}
function statusColor(s: ScheduleTask['status']) {
  switch (s) {
    case 'running': return 'primary'
    case 'pending': return 'indigo'
    case 'scheduled': return 'grey'
    case 'outdated': return 'orange'
    case 'accomplished': return 'green'
    case 'canceled': return 'red'
  }
}
function statusIcon(s: ScheduleTask['status']) {
  switch (s) {
    case 'running': return 'mdi-progress-clock'
    case 'pending': return 'mdi-timer-sand'
    case 'scheduled': return 'mdi-calendar-clock'
    case 'outdated': return 'mdi-clock-alert-outline'
    case 'accomplished': return 'mdi-check-circle-outline'
    case 'canceled': return 'mdi-close-circle-outline'
  }
}
function statusAvatarClass(s: ScheduleTask['status']) { return `status-avatar-${s}` }
function canCancel(s: ScheduleTask['status']) { return s !== 'running' && s !== 'accomplished' && s !== 'canceled' }
function handleTaskAction(t: ScheduleTask) { if (canCancel(t.status)) schedule.cancelSchedule(t.id); else schedule.deleteSchedule(t.id) }
function taskActionIcon(t: ScheduleTask) { return canCancel(t.status) ? 'mdi-close-circle-outline' : 'mdi-delete-outline' }
function taskActionLabel(t: ScheduleTask) { return (canCancel(t.status) ? '取消任务 ' : '删除任务 ') + t.id }
</script>

<style scoped>
/* 中文注释：调度页相关样式 */
.schedule-card {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e8e8e8;
}

.schedule-item+.schedule-item {
  border-top: 1px dashed #efefef;
}

.schedule-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  white-space: normal;
}

.status-avatar-running {
  background: #1976d2;
  color: #fff;
}

.status-avatar-pending {
  background: #3949ab;
  color: #fff;
}

.status-avatar-scheduled {
  background: #9e9e9e;
  color: #fff;
}

.status-avatar-outdated {
  background: #fb8c00;
  color: #fff;
}

.status-avatar-accomplished {
  background: #43a047;
  color: #fff;
}

.status-avatar-canceled {
  background: #e53935;
  color: #fff;
}
</style>
