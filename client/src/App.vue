<script setup>
import { ref, computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
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
    </section>

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
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles class="w-6 h-6 text-primary-light" />
              Analysis Report
            </h2>
            <button @click="analysisResult = null" class="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors">
              ← Back to Links
            </button>
          </div>
          
          <!-- Top row: Sentiment Chart + Summary -->
          <div class="grid md:grid-cols-3 gap-6">
            <!-- Donut Chart Card -->
            <div class="glass p-6 md:col-span-1 flex flex-col items-center border-white/10 relative overflow-hidden">
              <div class="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
              
              <div class="flex items-center gap-2 mb-4 self-start">
                <BarChart3 class="w-5 h-5 text-primary-light" />
                <h2 class="font-semibold text-white text-lg">Sentiment</h2>
              </div>

              <div class="relative w-48 h-48 mb-5">
                <Doughnut :data="chartData" :options="chartOptions" />
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-4xl drop-shadow-md">{{ sentimentEmoji }}</span>
                  <span class="text-xs font-bold text-slate-300 mt-2 uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/40 border border-white/10">
                    {{ dominantSentiment }}
                  </span>
                </div>
              </div>

              <!-- Legend -->
              <div class="flex flex-wrap justify-center w-full gap-4 text-sm mt-auto pt-4 border-t border-white/10">
                <div class="flex flex-col items-center gap-1">
                  <span class="w-3 h-3 rounded-full bg-positive shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                  <span class="font-bold text-white">{{ analysisResult.sentiment.positive }}%</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <span class="w-3 h-3 rounded-full bg-neutral-accent shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                  <span class="font-bold text-white">{{ analysisResult.sentiment.neutral }}%</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <span class="w-3 h-3 rounded-full bg-negative shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                  <span class="font-bold text-white">{{ analysisResult.sentiment.negative }}%</span>
                </div>
              </div>
            </div>

            <!-- Summary Card -->
            <div class="glass p-6 md:col-span-2 flex flex-col border-white/10">
              <div class="flex items-center gap-2 mb-4">
                <Sparkles class="w-5 h-5 text-primary-light" />
                <h2 class="font-semibold text-white text-lg">AI Insight Summary</h2>
              </div>
              <div class="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-xl p-5 flex-1 shadow-inner">
                <p class="text-slate-200 text-[15px] sm:text-base md:text-lg leading-relaxed font-light whitespace-pre-line">
                  {{ analysisResult.summary }}
                </p>
              </div>
            </div>
          </div>

        <!-- Feedback Row -->
          <div class="grid md:grid-cols-2 gap-6">
            <!-- Positive Feedback -->
            <div class="glass p-6 border-white/10 flex flex-col" style="min-height: 280px;">
              <div class="flex items-center gap-2 mb-4">
                <div class="p-1.5 rounded-lg bg-positive/10 border border-positive/20">
                  <ThumbsUp class="w-5 h-5 text-positive" />
                </div>
                <h2 class="font-semibold text-white text-lg">Positive Feedback</h2>
                <span v-if="analysisResult.positiveFeedbackIsAI" class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">🤖 AI Generated</span>
                <span v-else class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-positive/20 text-positive border border-positive/30 uppercase tracking-wider">📊 From Data</span>
                <TrendingUp class="w-4 h-4 text-positive ml-auto opacity-70" />
              </div>
              <div class="bg-gradient-to-br from-positive/5 to-transparent border border-positive/10 rounded-xl p-5 flex-1 shadow-inner overflow-y-auto custom-scrollbar" style="max-height: 200px;">
                <p class="text-slate-200 text-sm md:text-base leading-relaxed font-light whitespace-pre-line">
                  {{ analysisResult.positiveFeedback }}
                </p>
              </div>
            </div>

            <!-- Negative / Concern Feedback -->
            <div class="glass p-6 border-white/10 flex flex-col" style="min-height: 280px;">
              <div class="flex items-center gap-2 mb-4">
                <div class="p-1.5 rounded-lg bg-negative/10 border border-negative/20">
                  <ThumbsDown class="w-5 h-5 text-negative" />
                </div>
                <h2 class="font-semibold text-white text-lg">Concerns & Issues</h2>
                <span v-if="analysisResult.negativeFeedbackIsAI" class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">🤖 AI Generated</span>
                <span v-else class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-negative/20 text-negative border border-negative/30 uppercase tracking-wider">📊 From Data</span>
                <TrendingDown class="w-4 h-4 text-negative ml-auto opacity-70" />
              </div>
              <div class="bg-gradient-to-br from-negative/5 to-transparent border border-negative/10 rounded-xl p-5 flex-1 shadow-inner overflow-y-auto custom-scrollbar" style="max-height: 200px;">
                <p class="text-slate-200 text-sm md:text-base leading-relaxed font-light whitespace-pre-line">
                  {{ analysisResult.negativeFeedback }}
                </p>
              </div>
            </div>
          </div>

          <!-- Raw Comments Section -->
          <div v-if="analysisResult.enrichedResults?.some(r => r.comments && r.comments.length > 0)" class="glass p-6 border-white/10 mt-6">
            <div class="flex items-center gap-2 mb-4">
              <List class="w-5 h-5 text-primary-light" />
              <h2 class="font-semibold text-white text-lg">Raw Comments Extracted</h2>
            </div>
            
            <div class="space-y-6">
              <div v-for="(res, i) in analysisResult.enrichedResults" :key="i">
                <div v-if="res.comments && res.comments.length > 0" class="bg-black/20 rounded-xl p-4 border border-white/5">
                  <a :href="res.link" target="_blank" class="text-primary-light hover:underline font-medium text-sm mb-3 block">
                    {{ res.title }}
                  </a>
                  <div class="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-2">
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
