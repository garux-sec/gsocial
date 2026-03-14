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

ChartJS.register(ArcElement, Tooltip, Legend)

// ── Authentication ───────────────────────────────────────────────────
const isAuthenticated = ref(false)
const loginUsername = ref('')
const loginPassword = ref('')
const loginError = ref('')

function handleLogin() {
  if (loginUsername.value === 'admin' && loginPassword.value === 'G@rub0ng') {
    isAuthenticated.value = true
    loginError.value = ''
  } else {
    loginError.value = 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง'
  }
}

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
const fbTopic = ref('สงคราม ตะวันออกกลาง ประเทศอิหร่าน')
const fbFilteredPosts = ref([])
const fbFilteredCount = ref(null)
const loadingFbFilter = ref(false)

async function fetchFbPages() {
  try {
    const { data } = await axios.get('/api/fb-pages')
    fbPages.value = data.pages
    fbSelectedPages.value = data.pages.map(p => p.url)
  } catch (e) {
    console.error('Failed to fetch FB pages:', e)
  }
}

async function fetchAndFilterFbPosts() {
  if (fbSelectedPages.value.length === 0) {
    fbError.value = 'กรุณาเลือกอย่างน้อย 1 เพจ'
    return
  }
  if (!fbTopic.value.trim()) {
    fbError.value = 'กรุณาระบุประเด็นที่ต้องการค้นหา'
    return
  }
  
  loadingFbPosts.value = true
  loadingFbFilter.value = true
  fbError.value = ''
  fbPosts.value = []
  fbFilteredPosts.value = []
  fbFilteredCount.value = null
  
  try {
    // Step 1: Fetch posts
    const { data: fetchData } = await axios.post('/api/fb-pages/fetch', {
      pageUrls: fbSelectedPages.value,
      maxPosts: 5,
    })
    fbPosts.value = fetchData.posts || []
    
    if (fbPosts.value.length === 0) {
      fbError.value = 'ไม่พบโพสต์วันนี้จากเพจที่เลือก'
      loadingFbPosts.value = false
      loadingFbFilter.value = false
      return
    }
    
    loadingFbPosts.value = false

    // Step 2: Filter by topic + fetch comments
    const { data: filterData } = await axios.post('/api/fb-pages/filter-analyze', {
      posts: fbPosts.value,
      topic: fbTopic.value.trim(),
    })
    
    if (filterData.message && (!filterData.filteredPosts || filterData.filteredPosts.length === 0)) {
      fbError.value = filterData.message
      fbFilteredCount.value = 0
      return
    }
    
    fbFilteredPosts.value = filterData.filteredPosts || []
    fbFilteredCount.value = fbFilteredPosts.value.length
  } catch (e) {
    fbError.value = e.response?.data?.error || 'ดึงข้อมูลไม่สำเร็จ'
  } finally {
    loadingFbPosts.value = false
    loadingFbFilter.value = false
  }
}

function copyPostToClipboard(post) {
  const commentsText = post.fetchedComments && post.fetchedComments.length > 0
    ? post.fetchedComments.map(c => `  • ${c}`).join('\n')
    : '  ไม่มีความคิดเห็นที่มีความหมาย'
  
  const text = `${post.pageName}\nFacebook\n\nลิงก์ : ${post.url || '-'}\nเนื้อหา : ${post.text || '-'}\nความคิดเห็น :\n${commentsText}`
  
  navigator.clipboard.writeText(text).then(() => {
    post._copied = true
    setTimeout(() => { post._copied = false }, 2000)
  })
}

const fbAllCopied = ref(false)
function copyAllPosts() {
  if (fbFilteredPosts.value.length === 0) return
  
  const allText = fbFilteredPosts.value.map((post, i) => {
    const commentsText = post.fetchedComments && post.fetchedComments.length > 0
      ? post.fetchedComments.map(c => `  • ${c}`).join('\n')
      : '  ไม่มีความคิดเห็น'
    
    return `${'═'.repeat(50)}\n${i + 1}. ${post.pageName}\nFacebook\n\nลิงก์ : ${post.url || '-'}\nเนื้อหา : ${post.text || '-'}\nความคิดเห็น :\n${commentsText}`
  }).join('\n\n')
  
  const header = `📘 Facebook Pages Monitor\n📅 ${new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}\n🔍 ประเด็น: ${fbTopic.value}\n📊 จำนวนโพสต์ที่คัดกรอง: ${fbFilteredPosts.value.length}\n`
  
  navigator.clipboard.writeText(header + '\n' + allText).then(() => {
    fbAllCopied.value = true
    setTimeout(() => { fbAllCopied.value = false }, 2000)
  })
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
  <div class="min-h-screen relative font-sans text-slate-100 flex flex-col selection:bg-blue-500/30 selection:text-blue-200">
    <!-- Background Patterns -->
    <div class="absolute inset-0 pattern-bg pointer-events-none opacity-40"></div>
    <div class="absolute blob w-96 h-96 top-0 left-0 bg-blue-600/20 blur-[120px]"></div>
    <div class="absolute blob w-80 h-80 bottom-0 right-0 bg-blue-400/20 blur-[100px] animation-delay-2000"></div>

    <!-- ── Login Screen ─────────────────────────────────────────────────── -->
    <div v-if="!isAuthenticated" class="absolute inset-0 flex flex-col items-center justify-center p-4 z-20">
      <div class="max-w-md w-full glass p-8 sm:p-10 border-white/10 text-center relative overflow-hidden backdrop-blur-2xl">
        <div class="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-400/10 border border-blue-500/30 mb-6 shadow-lg shadow-blue-500/10">
          <Globe class="w-8 h-8 text-blue-400" />
        </div>
        <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 mb-2">
          Social Listening
        </h1>
        <p class="text-slate-400 text-sm mb-8">กรุณาเข้าสู่ระบบเพื่อใช้งาน Dashboard</p>

        <form @submit.prevent="handleLogin" class="space-y-5 text-left">
          <div>
            <label class="text-xs text-slate-400 mb-2 block uppercase tracking-wider font-semibold">ชื่อผู้ใช้งาน (Username)</label>
            <input v-model="loginUsername" type="text" 
                   class="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white
                          placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                          focus:border-blue-500/50 transition-all text-sm" />
          </div>
          <div>
            <label class="text-xs text-slate-400 mb-2 block uppercase tracking-wider font-semibold">รหัสผ่าน (Password)</label>
            <input v-model="loginPassword" type="password" 
                   class="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white
                          placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                          focus:border-blue-500/50 transition-all text-sm" />
          </div>
          
          <div v-if="loginError" class="p-3 bg-negative/10 border border-negative/20 rounded-xl text-negative text-sm text-center">
            {{ loginError }}
          </div>

          <button type="submit" class="w-full py-3.5 mt-2 rounded-xl font-bold text-white transition-all duration-300
                         bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600
                         border border-blue-500/30 hover:-translate-y-0.5 shadow-lg flex justify-center items-center">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>

    <!-- ── Main Dashboard ───────────────────────────────────────────────── -->
    <div v-else class="flex-1 flex flex-col relative z-30 w-full">
      <!-- Navbar w/ Logout -->
      <nav class="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-white/5 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-400/5 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Globe class="w-5 h-5 text-blue-400" />
          </div>
          <span class="font-bold text-lg md:text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
            Social Listening
          </span>
        </div>
        <button @click="isAuthenticated = false; loginUsername = ''; loginPassword = ''" 
                class="text-sm font-medium text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
          ออกจากระบบ
        </button>
      </nav>

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
          <div class="flex items-center gap-2 mb-5">
            <span class="text-xl">📘</span>
            <h2 class="font-bold text-white text-lg">Facebook Pages Monitor</h2>
            <span class="text-xs text-slate-500 ml-auto">ดึงและคัดกรองโพสต์ประจำวัน</span>
          </div>

          <!-- Topic Input (visible from start) -->
          <div class="mb-4">
            <label class="text-xs text-slate-400 mb-2 block uppercase tracking-wider">🔍 ประเด็น / คีย์เวิร์ดที่ต้องการค้นหา</label>
            <input v-model="fbTopic" type="text" 
                   placeholder="เช่น สถานการณ์สงครามตะวันออกกลาง, เศรษฐกิจไทย..."
                   class="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white
                          placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                          focus:border-blue-500/50 transition-all text-sm" />
          </div>

          <!-- Page Selection -->
          <div class="mb-4">
            <label class="text-xs text-slate-400 mb-2 block uppercase tracking-wider">📋 เลือกเพจที่ต้องการดึง</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <button v-for="page in fbPages" :key="page.url"
                      @click="toggleFbPage(page.url)"
                      class="flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200 text-left text-sm"
                      :class="fbSelectedPages.includes(page.url) 
                        ? 'bg-blue-500/10 border-blue-500/30 text-white' 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'">
                <div class="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                     :class="fbSelectedPages.includes(page.url) ? 'bg-blue-500 border-blue-500' : 'border-white/20'">
                  <span v-if="fbSelectedPages.includes(page.url)" class="text-white text-[10px]">✓</span>
                </div>
                <span class="truncate">{{ page.icon }} {{ page.name }}</span>
              </button>
            </div>
          </div>

          <!-- Fetch + Filter Button -->
          <div class="text-center mb-5">
            <button @click="fetchAndFilterFbPosts" :disabled="loadingFbPosts || loadingFbFilter || !fbTopic.trim() || fbSelectedPages.length === 0"
                    class="px-8 py-3 rounded-xl font-bold text-white transition-all duration-300
                           bg-gradient-to-r from-blue-500/30 to-cyan-500/30 hover:from-blue-500/40 hover:to-cyan-500/40
                           border border-blue-500/30 hover:-translate-y-0.5
                           disabled:opacity-40 disabled:cursor-not-allowed shadow-lg">
              <span v-if="loadingFbPosts" class="flex items-center gap-2">
                <span class="loader !w-5 !h-5 !border-2"></span>
                กำลังดึงโพสต์จาก {{ fbSelectedPages.length }} เพจ…
              </span>
              <span v-else-if="loadingFbFilter" class="flex items-center gap-2">
                <span class="loader !w-5 !h-5 !border-2"></span>
                AI กำลังคัดกรองและดึงความคิดเห็น…
              </span>
              <span v-else class="flex items-center gap-2">
                🔍 ดึงและคัดกรอง "{{ fbTopic }}" ({{ fbSelectedPages.length }} เพจ)
              </span>
            </button>
          </div>

          <!-- FB Error -->
          <div v-if="fbError" class="text-center text-amber-400 text-sm mb-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            {{ fbError }}
          </div>

          <!-- Filtered Count Badge -->
          <div v-if="fbFilteredCount !== null && !loadingFbFilter" class="text-center mb-4">
            <span v-if="fbFilteredCount > 0" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-positive/10 text-positive border border-positive/20">
              ✅ AI คัดกรองได้ {{ fbFilteredCount }} โพสต์ที่เกี่ยวข้องจาก {{ fbPosts.length }} โพสต์
            </span>
            <span v-else class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ⚠️ ไม่พบโพสต์ที่เกี่ยวข้องกับ "{{ fbTopic }}"
            </span>
          </div>

          <!-- Copy All Button -->
          <div v-if="fbFilteredPosts.length > 0" class="text-center mb-4">
            <button @click="copyAllPosts"
                    class="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                    :class="fbAllCopied 
                      ? 'bg-positive/20 text-positive border border-positive/30' 
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'">
              {{ fbAllCopied ? '✅ คัดลอกทั้งหมดแล้ว!' : '📋 Copy ทั้งหมด (' + fbFilteredPosts.length + ' โพสต์)' }}
            </button>
          </div>

          <!-- Filtered Post Cards (Results) -->
          <div v-if="fbFilteredPosts.length > 0" class="space-y-4">
            <div v-for="(post, i) in fbFilteredPosts" :key="i" 
                 class="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-white/5 overflow-hidden">
              
              <!-- Post Header -->
              <div class="bg-blue-500/10 px-5 py-3 border-b border-white/5 flex items-center gap-3">
                <img src="https://www.google.com/s2/favicons?domain=facebook.com&sz=64" class="w-7 h-7 rounded-lg shrink-0" alt="FB">
                <div>
                  <h3 class="text-white font-bold text-base">{{ post.pageName }}</h3>
                  <span class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">Facebook</span>
                </div>
                <button @click="copyPostToClipboard(post)" 
                        class="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 shrink-0"
                        :class="post._copied 
                          ? 'bg-positive/20 text-positive border border-positive/30' 
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'">
                  {{ post._copied ? '✅ คัดลอกแล้ว!' : '📋 Copy' }}
                </button>
              </div>
              
              <!-- Post Body -->
              <div class="px-5 py-4 space-y-3">
                <!-- Date/Time -->
                <div v-if="post.date">
                  <span class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">🕒 วันที่และเวลา</span>
                  <p class="text-slate-300 text-sm mt-1">{{ new Date(post.date).toLocaleString('th-TH') }}</p>
                </div>
                
                <!-- Link -->
                <div>
                  <span class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">🔗 ลิงก์</span>
                  <a :href="post.url" target="_blank" class="block text-blue-400 text-sm hover:underline mt-1 break-all">
                    {{ post.url || '-' }}
                  </a>
                </div>
                
                <!-- Content -->
                <div>
                  <span class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">📄 เนื้อหา</span>
                  <p class="text-slate-200 text-sm leading-relaxed mt-1 whitespace-pre-line">{{ post.text || '-' }}</p>
                </div>
                
                <!-- Comments -->
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">💬 ความคิดเห็น</span>
                    <span v-if="post.fetchedComments?.length" class="text-[10px] text-slate-600">({{ post.fetchedComments.length }} รายการ)</span>
                  </div>
                  <div v-if="post.fetchedComments && post.fetchedComments.length > 0" class="max-h-48 overflow-y-auto custom-scrollbar pr-2 space-y-1.5">
                    <div v-for="(comment, cid) in post.fetchedComments" :key="cid" 
                         class="bg-white/5 border border-white/5 px-3 py-2 rounded-lg text-sm text-slate-300 flex items-start gap-2">
                      <span class="text-slate-600 shrink-0 mt-0.5">•</span>
                      <span>{{ comment }}</span>
                    </div>
                  </div>
                  <p v-else class="text-slate-500 text-xs italic">ไม่พบความคิดเห็น</p>
                </div>
              </div>
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

          <!-- Detailed Post Cards (ข้อมูลเชิงลึกแต่ละโพสต์) -->
          <div v-if="analysisResult.enrichedResults?.length > 0" class="glass p-6 border-white/10">
            <div class="flex items-center gap-2 mb-5">
              <List class="w-5 h-5 text-blue-400" />
              <h2 class="font-bold text-white text-lg">ข้อมูลเชิงลึกแต่ละโพสต์</h2>
              <span class="ml-auto text-xs text-slate-500">{{ analysisResult.enrichedResults.length }} โพสต์ที่คัดกรอง</span>
            </div>
            
            <div class="space-y-5">
              <div v-for="(res, i) in analysisResult.enrichedResults" :key="i" 
                   class="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-white/5 overflow-hidden">
                
                <!-- Post Header -->
                <div class="bg-blue-500/10 px-5 py-3 border-b border-white/5 flex items-center gap-3">
                  <img src="https://www.google.com/s2/favicons?domain=facebook.com&sz=64" class="w-8 h-8 rounded-lg shrink-0" alt="FB">
                  <div>
                    <h3 class="text-white font-bold text-base">{{ res.pageName || res.title?.split(':')[0] || 'Unknown' }}</h3>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">{{ res.platform || res.commentSource || 'Facebook' }}</span>
                    </div>
                  </div>
                  <div class="ml-auto shrink-0">
                    <div class="bg-white rounded-lg p-1 shadow-lg">
                      <QrcodeVue :value="res.link || ''" :size="48" level="M" />
                    </div>
                  </div>
                </div>
                
                <!-- Post Body -->
                <div class="px-5 py-4 space-y-4">
                  <!-- Link -->
                  <div>
                    <span class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">🔗 ลิงก์</span>
                    <a :href="res.link" target="_blank" class="block text-blue-400 text-sm hover:underline mt-1 break-all">
                      {{ res.link }}
                    </a>
                  </div>
                  
                  <!-- Content -->
                  <div>
                    <span class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">📄 เนื้อหา</span>
                    <p class="text-slate-200 text-sm leading-relaxed mt-1 whitespace-pre-line">
                      {{ res.postContent || res.snippet || res.title }}
                    </p>
                  </div>
                  
                  <!-- Comments -->
                  <div v-if="res.comments && res.comments.length > 0">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">💬 ความคิดเห็น</span>
                      <span class="text-[10px] text-slate-600">({{ res.comments.length }} รายการ)</span>
                    </div>
                    <div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                      <div v-for="(comment, cid) in res.comments" :key="cid" 
                           class="bg-white/5 border border-white/5 p-3 rounded-lg text-sm text-slate-300 flex items-start gap-2">
                        <span class="text-slate-600 shrink-0">•</span>
                        <span>{{ comment }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-slate-500 text-xs italic">
                    💬 ไม่พบความคิดเห็น
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
    <footer v-if="isAuthenticated" class="text-center text-slate-600 text-xs mt-20 mb-4 pb-8 z-10 w-full relative">
      Built with Vue.js · Gemini AI · Google Search
    </footer>

    </div><!-- End Dashboard/v-else -->
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
