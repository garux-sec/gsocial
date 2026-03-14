<script setup>
import { ref, computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import QrcodeVue from 'qrcode.vue'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import {
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Globe,
  ExternalLink,
  Sparkles,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Zap,
  List,
  CheckSquare,
  Square,
  Clock,
} from 'lucide-vue-next'
import axios from 'axios'

ChartJS.register(ArcElement, Tooltip, Legend)

// ── State ────────────────────────────────────────────────────────────
const keyword = ref('')
const loadingSearch = ref(false)
const loadingAnalysis = ref(false)
const error = ref('')
const searchResults = ref([]) // All results from backend
const visibleCount = ref(10) // Pagination: show 10 initially
const analysisResult = ref(null) // From step 2
const searchHistory = ref([
  { keyword: 'ไทย-กัมพูชา', time: '10:00' },
  { keyword: 'สถานการณ์ชายแดน', time: '09:30' },
])
const suggestedTags = ['ชายแดนไทย-กัมพูชา', 'สถานการณ์ชายแดนไทยกัมพูชา', 'การค้าชายแดน', 'ความมั่นคง']
const searchType = ref('')

// ── Chart config ─────────────────────────────────────────────────────
const chartData = computed(() => {
  if (!analysisResult.value) return null
  const s = analysisResult.value.sentiment
  return {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [
      {
        data: [s.positive, s.neutral, s.negative],
        backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
        borderColor: ['#16a34a', '#d97706', '#dc2626'],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15,12,41,0.9)',
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(99,102,241,0.3)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`,
      },
    },
  },
}

// ── Computed ─────────────────────────────────────────────────────────
const displayedResults = computed(() => {
  if (!searchResults.value) return []
  return searchResults.value.slice(0, visibleCount.value)
})

const hasMoreResults = computed(() => {
  return searchResults.value && visibleCount.value < searchResults.value.length
})

const selectedResultsCount = computed(() => {
  return searchResults.value ? searchResults.value.filter((r) => r.selected).length : 0
})

const allSelected = computed(() => {
  return displayedResults.value.length > 0 && displayedResults.value.every(r => r.selected)
})

// ── Helpers ──────────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Step 1: Search ───────────────────────────────────────────────────
async function handleSearch() {
  if (!keyword.value.trim()) return
  loadingSearch.value = true
  error.value = ''
  searchResults.value = []
  visibleCount.value = 10
  analysisResult.value = null

  try {
    const { data } = await axios.post('/api/search', {
      keyword: keyword.value.trim(),
    })
    
    // Default to unchecked for new searches
    const items = data.results || []
    searchResults.value = items.map(item => ({ ...item, selected: false }))
    searchType.value = data.searchType
    
    // Add to history
    searchHistory.value = [
      { keyword: data.keyword, time: new Date().toLocaleTimeString() },
      ...searchHistory.value.filter((h) => h.keyword !== data.keyword),
    ].slice(0, 8)
  } catch (e) {
    error.value =
      e.response?.data?.error || e.message || 'Search failed.'
  } finally {
    loadingSearch.value = false
  }
}

// ── Pagination & Selection ───────────────────────────────────────────
function loadMore() {
  visibleCount.value += 10
}

function toggleAllSelection() {
  const newVal = !allSelected.value
  displayedResults.value.forEach(r => r.selected = newVal)
}

function toggleSelection(res) {
  res.selected = !res.selected
}

// ── Step 2: Analyze ──────────────────────────────────────────────────
async function handleAnalyze() {
  const resultsToAnalyze = searchResults.value.filter(r => r.selected)
  
  if (!resultsToAnalyze || resultsToAnalyze.length === 0) {
    error.value = 'Please select at least one search result to analyze.'
    return
  }
  
  loadingAnalysis.value = true
  error.value = ''

  try {
    const { data } = await axios.post('/api/analyze', {
      keyword: keyword.value.trim(),
      searchType: searchType.value,
      results: resultsToAnalyze, // Send only selected results
    })
    analysisResult.value = data
  } catch (e) {
    error.value =
      e.response?.data?.error || e.message || 'Analysis failed.'
  } finally {
    loadingAnalysis.value = false
  }
}

function searchFromHistory(kw) {
  keyword.value = kw
  handleSearch()
}

// ── Facebook Pages Feature ──────────────────────────────────────────
const fbPages = ref([])
const fbPosts = ref([])
const loadingFbPosts = ref(false)
const fbSelectedPages = ref([])
const showFbPanel = ref(false)
const fbError = ref('')

async function fetchFbPages() {
  try {
    const { data } = await axios.get('/api/fb-pages')
    fbPages.value = data.pages
    fbSelectedPages.value = data.pages.map(p => p.url) // Select all by default
  } catch (e) {
    console.error('Failed to fetch FB pages:', e)
  }
}

async function fetchFbPosts() {
  if (fbSelectedPages.value.length === 0) {
    fbError.value = 'กรุณาเลือกอย่างน้อย 1 เพจ'
    return
  }
  
  loadingFbPosts.value = true
  fbError.value = ''
  fbPosts.value = []
  
  try {
    const { data } = await axios.post('/api/fb-pages/fetch', {
      pageUrls: fbSelectedPages.value,
      maxPosts: 5,
    })
    fbPosts.value = data.posts || []
    if (fbPosts.value.length === 0) {
      fbError.value = 'ไม่พบโพสต์วันนี้จากเพจที่เลือก'
    }
  } catch (e) {
    fbError.value = e.response?.data?.error || 'ดึงข้อมูลเพจไม่สำเร็จ'
  } finally {
    loadingFbPosts.value = false
  }
}

async function analyzeFbPosts() {
  if (fbPosts.value.length === 0) return
  
  loadingAnalysis.value = true
  error.value = ''
  
  // Convert FB posts to the same format as search results
  const results = fbPosts.value.map(p => ({
    title: p.pageName + ': ' + (p.text?.substring(0, 80) || 'โพสต์'),
    snippet: p.text || '',
    link: p.url || '',
    selected: true,
  }))
  
  try {
    const { data } = await axios.post('/api/analyze', {
      keyword: 'Facebook Pages - ' + new Date().toLocaleDateString('th-TH'),
      searchType: 'facebook-pages',
      results,
    })
    analysisResult.value = data
    keyword.value = 'Facebook Pages Monitor'
  } catch (e) {
    error.value = e.response?.data?.error || 'วิเคราะห์ไม่สำเร็จ'
  } finally {
    loadingAnalysis.value = false
  }
}

function toggleFbPage(url) {
  const idx = fbSelectedPages.value.indexOf(url)
  if (idx >= 0) fbSelectedPages.value.splice(idx, 1)
  else fbSelectedPages.value.push(url)
}

// Load FB pages on mount
fetchFbPages()

// ── Insight Helpers ──────────────────────────────────────────────────
const dominantSentiment = computed(() => {
  if (!analysisResult.value) return null
  const s = analysisResult.value.sentiment
  if (s.positive >= s.neutral && s.positive >= s.negative) return 'positive'
  if (s.negative >= s.neutral && s.negative >= s.positive) return 'negative'
  return 'neutral'
})

const sentimentEmoji = computed(() => {
  const map = { positive: '😊', neutral: '😐', negative: '😟' }
  return map[dominantSentiment.value] || ''
})
</script>

<!-- template parts are skipped since I only want to show the full structure below -->
<template>
  <div class="min-h-screen pb-12">
    <!-- Header -->
    <header class="px-4 pt-8 pb-4 text-center">
      <div class="flex items-center justify-center gap-3 mb-2">
        <div class="p-2 rounded-xl bg-primary/20">
          <Zap class="w-7 h-7 text-primary-light" />
        </div>
        <h1 class="text-3xl md:text-4xl font-bold tracking-tight">
          <span class="text-primary-light">Social</span>
          <span class="text-white"> Listening</span>
        </h1>
      </div>
      <p class="text-slate-400 text-sm flex items-center justify-center gap-2">
        <span>Step 1: Search News/Links</span>
        <span class="text-white/20">→</span>
        <span>Step 2: AI Sentiment Analysis</span>
      </p>
    </header>

    <!-- Search Bar -->
    <section class="max-w-2xl mx-auto px-4 mb-8">
      <form @submit.prevent="handleSearch" class="flex gap-3">
        <div class="relative flex-1">
          <Search
            class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
          />
          <input
            id="search-input"
            v-model="keyword"
            type="text"
            placeholder="Enter a keyword or topic to search…"
            class="w-full py-3.5 pl-12 pr-4 rounded-xl bg-white/5 border border-white/10 text-white
                   placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50
                   focus:border-primary/50 transition-all duration-300"
          />
        </div>
        <button
          id="search-button"
          type="submit"
          :disabled="loadingSearch || !keyword.trim()"
          class="px-6 py-3.5 rounded-xl font-semibold text-white transition-all duration-300
                 bg-white/10 hover:bg-white/20 border border-white/10
                 disabled:opacity-40 disabled:cursor-not-allowed
                 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-black/20"
        >
          <span v-if="loadingSearch" class="flex items-center gap-2">
            <span class="loader !w-5 !h-5 !border-2"></span>
          </span>
          <span v-else class="flex items-center gap-2">
            <Search class="w-4 h-4" />
            Find Links
          </span>
        </button>
      </form>

      <!-- Facebook Pages Toggle Button -->
      <div class="mt-4 text-center">
        <button @click="showFbPanel = !showFbPanel" 
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300"
                :class="showFbPanel 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'">
          <span class="text-lg">📘</span>
          {{ showFbPanel ? 'ซ่อน Facebook Monitor' : 'Facebook Pages Monitor' }}
        </button>
      </div>
    </section>

    <!-- Facebook Pages Panel -->
    <Transition name="fade">
      <div v-if="showFbPanel" class="max-w-4xl mx-auto mb-8 px-4">
        <div class="glass p-6 border-white/10">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-xl">📘</span>
            <h2 class="font-bold text-white text-lg">Facebook Pages Monitor</h2>
            <span class="text-xs text-slate-500 ml-auto">ดึงโพสต์ประจำวันจากเพจที่กำหนด</span>
          </div>

          <!-- Page Selection -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <button v-for="page in fbPages" :key="page.url"
                    @click="toggleFbPage(page.url)"
                    class="flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left"
                    :class="fbSelectedPages.includes(page.url) 
                      ? 'bg-blue-500/10 border-blue-500/30 text-white' 
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'">
              <img src="https://www.google.com/s2/favicons?domain=facebook.com&sz=64" class="w-6 h-6 rounded" alt="FB">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ page.icon }} {{ page.name }}</p>
              </div>
              <div class="w-5 h-5 rounded border flex items-center justify-center shrink-0"
                   :class="fbSelectedPages.includes(page.url) ? 'bg-blue-500 border-blue-500' : 'border-white/20'">
                <span v-if="fbSelectedPages.includes(page.url)" class="text-white text-xs">✓</span>
              </div>
            </button>
          </div>

          <!-- Fetch Button -->
          <div class="text-center mb-5">
            <button @click="fetchFbPosts" :disabled="loadingFbPosts || fbSelectedPages.length === 0"
                    class="px-6 py-2.5 rounded-xl font-semibold text-white transition-all duration-300
                           bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30
                           disabled:opacity-40 disabled:cursor-not-allowed">
              <span v-if="loadingFbPosts" class="flex items-center gap-2">
                <span class="loader !w-4 !h-4 !border-2"></span>
                กำลังดึงข้อมูล… (อาจใช้เวลา 1-3 นาที)
              </span>
              <span v-else class="flex items-center gap-2">
                📥 ดึงโพสต์วันนี้ ({{ fbSelectedPages.length }} เพจ)
              </span>
            </button>
          </div>

          <!-- FB Error -->
          <div v-if="fbError" class="text-center text-amber-400 text-sm mb-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            {{ fbError }}
          </div>

          <!-- Fetched Posts -->
          <div v-if="fbPosts.length > 0" class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-white font-semibold text-base">โพสต์ที่ดึงมาได้ ({{ fbPosts.length }})</h3>
            </div>
            
            <div class="grid gap-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
              <div v-for="(post, i) in fbPosts" :key="i" 
                   class="bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl border border-white/5 p-4">
                <div class="flex items-start gap-3">
                  <img src="https://www.google.com/s2/favicons?domain=facebook.com&sz=64" class="w-8 h-8 rounded-lg mt-0.5 shrink-0" alt="FB">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-white font-semibold text-sm">{{ post.pageName }}</span>
                      <span class="text-[10px] text-slate-500">{{ post.date }}</span>
                    </div>
                    <p class="text-slate-300 text-sm leading-relaxed line-clamp-3 mb-2">{{ post.text }}</p>
                    <div class="flex items-center gap-4 text-xs text-slate-500">
                      <span>👍 {{ post.likes }}</span>
                      <span>💬 {{ post.comments }}</span>
                      <span>🔄 {{ post.shares }}</span>
                      <a v-if="post.url" :href="post.url" target="_blank" class="text-blue-400 hover:underline ml-auto">ดูโพสต์ →</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Analyze Button -->
            <div class="text-center pt-4">
              <button @click="analyzeFbPosts" :disabled="loadingAnalysis"
                      class="px-8 py-3 rounded-xl font-bold text-white transition-all duration-300
                             bg-gradient-to-r from-blue-500/30 to-cyan-500/30 hover:from-blue-500/40 hover:to-cyan-500/40
                             border border-blue-500/30 hover:-translate-y-0.5
                             disabled:opacity-40 disabled:cursor-not-allowed shadow-lg">
                <span v-if="loadingAnalysis" class="flex items-center gap-2">
                  <span class="loader !w-5 !h-5 !border-2"></span>
                  กำลังวิเคราะห์…
                </span>
                <span v-else class="flex items-center gap-2">
                  <Sparkles class="w-5 h-5" />
                  วิเคราะห์โพสต์ทั้งหมด ({{ fbPosts.length }} โพสต์)
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Error State -->
    <div v-if="error" class="max-w-xl mx-auto px-4 mb-8">
      <div class="glass-alt p-6 text-center border-negative/30">
        <AlertCircle class="w-10 h-10 text-negative mx-auto mb-3" />
        <p class="text-negative font-medium mb-1">Error Occurred</p>
        <p class="text-slate-400 text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- MAIN CONTENT AREA -->
    <div class="max-w-6xl mx-auto px-4 space-y-8">
      
      <!-- STEP 1: Search Results List -->
      <Transition name="fade">
        <div v-if="searchResults.length > 0 && !loadingSearch" class="glass p-6 border-white/10">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <List class="w-5 h-5 text-primary-light" />
                <h2 class="font-semibold text-white text-lg">Found {{ searchResults.length }} Results</h2>
                <span class="px-2 py-0.5 ml-2 rounded text-[10px] font-medium tracking-wider uppercase"
                      :class="searchType === 'social' ? 'bg-primary/20 text-primary-light border border-primary/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'">
                  {{ searchType }}
                </span>
              </div>
              <p class="text-sm text-slate-400 select-none cursor-pointer hover:text-white transition-colors flex items-center gap-2" @click="toggleAllSelection">
                <CheckSquare v-if="allSelected" class="w-4 h-4 text-primary-light" />
                <Square v-else class="w-4 h-4" />
                <span>Select links to include in AI analysis ({{ selectedResultsCount }} selected)</span>
              </p>
            </div>
            
            <!-- ANALYZE BUTTON -->
            <button
              v-if="!analysisResult && !loadingAnalysis"
              @click="handleAnalyze"
              :disabled="selectedResultsCount === 0"
              class="px-5 py-2.5 rounded-xl font-semibold text-white transition-all duration-300
                     bg-gradient-to-r from-primary to-purple-500 hover:from-primary-light hover:to-purple-400
                     shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              <Sparkles class="w-4 h-4 shrink-0" />
              <span>Analyze {{ selectedResultsCount }} Links</span>
            </button>
          </div>

          <div v-if="loadingAnalysis" class="flex flex-col items-center justify-center py-12 bg-black/20 rounded-xl mb-6 border border-white/5">
            <div class="loader mb-4 border-primary-light"></div>
            <p class="text-primary-light font-medium animate-pulse">
              Gemini AI is reading and analyzing the content…
            </p>
          </div>

          <!-- The List (1 Column Grid) -->
          <div v-if="!analysisResult && !loadingAnalysis" class="grid grid-cols-1 gap-4">
            <div
              v-for="(res, i) in displayedResults"
              :key="i"
              class="glass-alt p-4 flex gap-4 group transition-all duration-200 border border-white/5 hover:border-primary/30 cursor-pointer"
              :class="{'bg-primary/5 border-primary/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]': res.selected}"
              @click="toggleSelection(res)"
            >
              <!-- Checkbox -->
              <div class="mt-0.5 shrink-0">
                <CheckSquare v-if="res.selected" class="w-5 h-5 text-primary-light" />
                <Square v-else class="w-5 h-5 text-slate-500 group-hover:text-slate-400" />
              </div>

              <!-- Card Content -->
              <div class="flex-1 min-w-0 flex flex-col">
                <div class="flex gap-2 flex-wrap items-center mb-1.5 opacity-80">
                  <img v-if="res.favicon" :src="res.favicon" class="w-4 h-4 rounded-sm bg-black/20" @error="res.favicon = null" />
                  <Globe v-else class="w-4 h-4 text-slate-500" />
                  <span class="text-xs font-medium text-slate-300 truncate">{{ res.pageName || res.publisher || 'Web' }}</span>
                  <span v-if="res.pageName && res.pageName !== res.publisher" class="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">{{ res.publisher.replace('.com', '') }}</span>
                  <span class="text-slate-600 text-[10px] items-center">•</span>
                  <span class="text-xs text-slate-400 flex items-center gap-1 shrink-0"><Clock class="w-3 h-3"/>{{ formatDate(res.pubDate) }}</span>
                </div>
                
                <a :href="res.link" target="_blank" rel="noopener noreferrer" @click.stop class="block mb-2">
                  <h3 class="text-lg font-semibold text-slate-100 group-hover:text-primary-light transition-colors line-clamp-2 leading-snug">
                    {{ res.title }}
                  </h3>
                </a>
                
                <p class="text-sm text-slate-400 line-clamp-2 leading-relaxed mt-auto">
                  {{ res.snippet }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Pagination -->
          <div v-if="!analysisResult && !loadingAnalysis && hasMoreResults" class="mt-6 flex justify-center">
            <button
              @click="loadMore"
              class="px-6 py-2 rounded-full text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10
                     border border-white/10 hover:border-white/20 transition-all duration-200 shadow-sm"
            >
              Load 10 More Results
            </button>
          </div>
          <div v-if="!analysisResult && !loadingAnalysis && !hasMoreResults && searchResults.length > 0" class="mt-6 text-center text-slate-500 text-xs">
            Showing all {{ searchResults.length }} results
          </div>
        </div>
      </Transition>

      <div v-if="searchResults.length === 0 && !loadingSearch && searchHistory.length > 0 && !error" class="text-center py-12 text-slate-400">
        No results found for this keyword. Try something else.
      </div>

      <!-- STEP 2: AI Analysis Results -->
      <Transition name="fade">
        <div v-if="analysisResult && !loadingAnalysis" class="space-y-6">
          
          <!-- Report Header -->
          <div class="glass p-6 border-white/10 text-center relative overflow-hidden">
            <div class="absolute -top-20 -left-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div class="absolute -bottom-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <h1 class="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 mb-1">Social Listening</h1>
            <p class="text-slate-400 text-sm mb-3">{{ new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
            <p class="text-lg md:text-xl font-semibold text-white">ประเด็น: <span class="text-blue-400">{{ keyword || 'การวิเคราะห์' }}</span></p>
            <button @click="analysisResult = null" class="absolute top-4 right-4 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors">
              ← กลับไปหน้ารายการ
            </button>
          </div>

          <!-- AI Summary Section -->
          <div class="glass p-6 border-white/10">
            <div class="flex items-center gap-2 mb-4">
              <Sparkles class="w-5 h-5 text-blue-400" />
              <h2 class="font-bold text-white text-lg">ภาพรวมสรุป</h2>
            </div>
            <div class="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/15 rounded-xl p-5 shadow-inner">
              <p class="text-slate-200 text-base md:text-lg leading-relaxed font-light whitespace-pre-line text-center">
                {{ analysisResult.summary }}
              </p>
            </div>
          </div>


          <!-- Public Opinion Section (เชิงบวก / เชิงลบ) -->
          <div class="glass p-6 border-white/10">
            <div class="text-center mb-5">
              <h2 class="text-xl font-bold text-white">ความคิดเห็นของประชาชน</h2>
            </div>
            <div class="grid md:grid-cols-2 gap-6">
              <!-- เชิงบวก (Positive) -->
              <div class="flex flex-col" style="min-height: 250px;">
                <div class="flex items-center justify-center gap-2 mb-3">
                  <h3 class="text-lg font-bold text-positive">เชิงบวก</h3>
                  <div class="w-6 h-6 rounded-full bg-positive flex items-center justify-center text-white text-sm font-bold">+</div>
                  <span v-if="analysisResult.positiveFeedbackIsAI" class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">🤖 AI</span>
                  <span v-else class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-positive/20 text-positive border border-positive/30 uppercase">📊 Data</span>
                </div>
                <div class="bg-gradient-to-br from-positive/5 to-transparent border border-positive/10 rounded-xl p-5 flex-1 shadow-inner overflow-y-auto custom-scrollbar" style="max-height: 200px;">
                  <p class="text-slate-200 text-sm md:text-base leading-relaxed font-light whitespace-pre-line text-center">
                    {{ analysisResult.positiveFeedback }}
                  </p>
                </div>
              </div>

              <!-- เชิงลบ (Negative) -->
              <div class="flex flex-col" style="min-height: 250px;">
                <div class="flex items-center justify-center gap-2 mb-3">
                  <h3 class="text-lg font-bold text-negative">เชิงลบ</h3>
                  <div class="w-6 h-6 rounded-full bg-negative flex items-center justify-center text-white text-sm font-bold">−</div>
                  <span v-if="analysisResult.negativeFeedbackIsAI" class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">🤖 AI</span>
                  <span v-else class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-negative/20 text-negative border border-negative/30 uppercase">📊 Data</span>
                </div>
                <div class="bg-gradient-to-br from-negative/5 to-transparent border border-negative/10 rounded-xl p-5 flex-1 shadow-inner overflow-y-auto custom-scrollbar" style="max-height: 200px;">
                  <p class="text-slate-200 text-sm md:text-base leading-relaxed font-light whitespace-pre-line text-center">
                    {{ analysisResult.negativeFeedback }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Sentiment Overview (ภาพรวมความคิดเห็น) -->
          <div class="glass p-6 border-white/10">
            <div class="text-center mb-5">
              <h2 class="text-xl font-bold text-white">ภาพรวมความคิดเห็น</h2>
            </div>
            <div class="flex flex-col md:flex-row items-center justify-center gap-8">
              <!-- Donut Chart -->
              <div class="relative w-48 h-48">
                <Doughnut :data="chartData" :options="chartOptions" />
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-4xl drop-shadow-md">{{ sentimentEmoji }}</span>
                  <span class="text-xs font-bold text-slate-300 mt-2 uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/40 border border-white/10">
                    {{ dominantSentiment }}
                  </span>
                </div>
              </div>

              <!-- Thai Legend -->
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-3">
                  <span class="w-5 h-5 rounded bg-positive shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                  <span class="text-white font-semibold text-base">เชิงบวก</span>
                  <span class="text-positive font-bold text-lg ml-2">{{ analysisResult.sentiment.positive }}%</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-5 h-5 rounded bg-neutral-accent shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                  <span class="text-white font-semibold text-base">ทั่วไป</span>
                  <span class="text-neutral-accent font-bold text-lg ml-2">{{ analysisResult.sentiment.neutral }}%</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-5 h-5 rounded bg-negative shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                  <span class="text-white font-semibold text-base">เชิงลบ</span>
                  <span class="text-negative font-bold text-lg ml-2">{{ analysisResult.sentiment.negative }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Source Media Cards with QR Codes (ตัวอย่างสื่อที่น่าสนใจ) -->
          <div class="glass p-6 border-white/10">
            <div class="flex items-center gap-2 mb-5">
              <ExternalLink class="w-5 h-5 text-blue-400" />
              <h2 class="font-bold text-white text-lg">ตัวอย่างสื่อที่น่าสนใจ</h2>
              <span class="ml-auto text-xs text-slate-500">{{ analysisResult.enrichedResults?.length || 0 }} แหล่งข้อมูล</span>
            </div>
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="(res, i) in (analysisResult.enrichedResults || [])" :key="i" 
                   class="bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl border border-white/5 p-4 hover:border-blue-500/30 transition-all duration-300 group">
                <!-- Platform Icon + Badge -->
                <div class="flex items-center gap-2 mb-3">
                  <img v-if="res.link?.includes('youtube.com') || res.link?.includes('youtu.be')" 
                       src="https://www.google.com/s2/favicons?domain=youtube.com&sz=64" 
                       class="w-8 h-8 rounded-lg" alt="YouTube">
                  <img v-else-if="res.link?.includes('facebook.com')" 
                       src="https://www.google.com/s2/favicons?domain=facebook.com&sz=64" 
                       class="w-8 h-8 rounded-lg" alt="Facebook">
                  <img v-else-if="res.link?.includes('tiktok.com')" 
                       src="https://www.google.com/s2/favicons?domain=tiktok.com&sz=64" 
                       class="w-8 h-8 rounded-lg" alt="TikTok">
                  <img v-else-if="res.link?.includes('instagram.com')" 
                       src="https://www.google.com/s2/favicons?domain=instagram.com&sz=64" 
                       class="w-8 h-8 rounded-lg" alt="Instagram">
                  <img v-else 
                       src="https://www.google.com/s2/favicons?domain=google.com&sz=64" 
                       class="w-8 h-8 rounded-lg" alt="Web">
                  
                  <!-- Source Badge -->
                  <span v-if="res.commentSource === 'YouTube'" class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase">YouTube</span>
                  <span v-else-if="res.commentSource === 'Facebook'" class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">Facebook</span>
                  <span v-else-if="res.commentSource === 'TikTok'" class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">TikTok</span>
                  <span v-else-if="res.commentSource === 'Instagram'" class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 uppercase">Instagram</span>
                  
                  <span v-if="res.comments?.length" class="ml-auto text-[10px] text-slate-500">{{ res.comments.length }} ความคิดเห็น</span>
                </div>
                
                <!-- Title -->
                <a :href="res.link" target="_blank" class="text-slate-200 text-sm font-medium leading-snug mb-3 block hover:text-blue-400 transition-colors line-clamp-2">
                  {{ res.title }}
                </a>
                
                <!-- QR Code + Link -->
                <div class="flex items-end justify-between mt-auto pt-3 border-t border-white/5">
                  <div class="flex-1 min-w-0 pr-3">
                    <p class="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">ลิงก์ต้นทาง</p>
                    <a :href="res.link" target="_blank" class="text-blue-400 text-xs hover:underline truncate block">
                      {{ res.link }}
                    </a>
                  </div>
                  <div class="bg-white rounded-lg p-1.5 shadow-lg shrink-0 group-hover:scale-105 transition-transform">
                    <QrcodeVue :value="res.link || ''" :size="64" level="M" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Raw Comments Section -->
          <div v-if="analysisResult.enrichedResults?.some(r => r.comments && r.comments.length > 0)" class="glass p-6 border-white/10">
            <div class="flex items-center gap-2 mb-4">
              <List class="w-5 h-5 text-blue-400" />
              <h2 class="font-bold text-white text-lg">ความคิดเห็นจากแหล่งข้อมูล</h2>
            </div>
            
            <div class="space-y-6">
              <div v-for="(res, i) in analysisResult.enrichedResults" :key="i">
                <div v-if="res.comments && res.comments.length > 0" class="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div class="flex items-center gap-2 mb-3">
                    <span v-if="res.commentSource === 'YouTube'" class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider shrink-0">▶ YouTube</span>
                    <span v-else-if="res.commentSource === 'Facebook'" class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider shrink-0">📘 Facebook</span>
                    <span v-else-if="res.commentSource === 'TikTok'" class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase tracking-wider shrink-0">🎵 TikTok</span>
                    <span v-else-if="res.commentSource === 'Instagram'" class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30 uppercase tracking-wider shrink-0">📷 Instagram</span>
                    <a :href="res.link" target="_blank" class="text-blue-400 hover:underline font-medium text-sm truncate">
                      {{ res.title }}
                    </a>
                    <span class="ml-auto text-[10px] text-slate-500 shrink-0">{{ res.comments.length }} ความคิดเห็น</span>
                  </div>
                  <div class="max-h-80 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                    <div v-for="(comment, cid) in res.comments" :key="cid" class="glass-alt p-3 rounded-lg text-sm text-slate-300">
                      {{ comment }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

    </div>

    <!-- Empty State -->
    <div v-if="searchResults.length === 0 && !loadingSearch && !error" class="text-center py-20 px-4">
      <div class="inline-flex p-4 rounded-2xl bg-white/5 border border-white/10 mb-6 shadow-xl">
        <Globe class="w-12 h-12 text-slate-400" />
      </div>
      <h2 class="text-xl sm:text-2xl font-semibold text-white mb-2">
        Find Social Chatter
      </h2>
      <p class="text-slate-400 max-w-md mx-auto text-sm leading-relaxed mb-8">
        Enter a keyword above to find recent news and discussions. You can then hand-pick the links to analyze with Gemini AI.
      </p>
      
      <!-- Search History (Shows in empty state) -->
      <div v-if="searchHistory.length" class="max-w-xl mx-auto glass p-6 text-left border-white/10">
        <div class="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
          <Search class="w-4 h-4 text-primary-light" />
          <h3 class="font-medium text-slate-300 text-sm">Recent Searches</h3>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(h, i) in searchHistory"
            :key="i"
            @click="searchFromHistory(h.keyword)"
            class="px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-white/5
                   text-slate-300 hover:bg-primary/20 hover:border-primary/30
                   hover:text-primary-light transition-all duration-200"
          >
            {{ h.keyword }}
          </button>
        </div>
      </div>
      
      <!-- Tag suggestions if no history -->
      <div v-else class="flex justify-center flex-wrap gap-3">
        <button
          v-for="tag in suggestedTags"
          :key="tag"
          @click="keyword = tag; handleSearch()"
          class="px-4 py-2 rounded-lg text-sm border border-white/10 bg-white/5
                 text-slate-400 hover:bg-primary/20 hover:border-primary/30
                 hover:text-primary-light transition-all duration-200"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- Footer -->
    <footer class="text-center text-slate-600 text-xs mt-20 mb-4">
      Built with Vue.js · Gemini AI · Google Search
    </footer>
  </div>
</template>

<style scoped>
/* Custom Scrollbar for results list if needed */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}
</style>
