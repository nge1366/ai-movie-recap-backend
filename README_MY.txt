AI MOVIE RECAP STUDIO — BACKEND STARTER V45
===========================================

ဒီ ZIP က Backend API ကို စမ်းသပ်ချိတ်ဆက်နိုင်ရန် V45 Starter ဖြစ်ပါတယ်။
တကယ့် AI Video ထုတ်လုပ်ဖို့ Provider Adapter ကို သက်ဆိုင်ရာ Provider API စာရွက်စာတမ်းအတိုင်း Developer က ထပ်ရေးရပါမယ်။ ဒီ Starter တစ်ခုတည်းနဲ့ Video မထုတ်ပေးပါ။

လိုအပ်ချက်
---------
- Node.js 20 သို့မဟုတ် ပိုသစ်သော Version
- HTTPS ဖြင့် Hosting လုပ်နိုင်သော Server
- အသုံးပြုခွင့်ရှိသော AI Video Provider API နှင့် Developer ရေးသားထားသော Adapter

တပ်ဆင်ပုံ
---------
1. ZIP ကို ဖြည်ပါ။
2. Folder ထဲမှာ Terminal ဖွင့်ပါ။
3. npm install လုပ်ပါ။
4. .env.example ကို .env အဖြစ် ကူးပါ။
5. BACKEND_ACCESS_TOKEN ကို အနည်းဆုံး ၂၄ လုံးရှိတဲ့ Random Secret အသစ်ဖြင့် အစားထိုးပါ။
6. CORS_ORIGIN ကို HTML App ကို Hosting လုပ်ထားတဲ့ Website Origin အတိအကျ ထည့်ပါ။ * မသုံးပါနှင့်။
7. npm start ဖြင့် Server စတင်ပါ။
8. https://YOUR_SERVER/health နှင့် https://YOUR_SERVER/capabilities ကို Browser မှ စမ်းပါ။
9. App V45 ထဲမှာ Server URL နဲ့ Backend Access Token ထည့်ပြီး “ချိတ်ဆက်မှု စမ်းရန်” ကိုနှိပ်ပါ။

V45 API Endpoint များ
-------------------
GET  /health                    Server အသက်ရှင်မှု၊ API Version၊ Provider Ready
GET  /capabilities              API အကန့်အသတ်၊ Endpoint စာရင်း
POST /jobs                      Bearer Token ဖြင့် Scene Pack ပို့ရန်
GET  /jobs/:jobId               Render အခြေအနေစစ်ရန်
POST /jobs/:jobId/cancel        Cancel တောင်းဆိုရန်

စစ်ဆေးမှုနှင့် ကန့်သတ်ချက်
------------------------
- Scene တစ်ခုစီ Prompt ကို အများဆုံး ၉၀၀ Unicode စာလုံးအဖြစ် စစ်ဆေးသည်။
- Job တစ်ခုတွင် Scene အများဆုံး ၆၀ ခွင့်ပြုထားသည်။
- Provider မချိတ်ဆက်ထားလျှင် POST /jobs က 503 VIDEO_PROVIDER_NOT_CONFIGURED ပြန်ပေးမည်။
- Health/Capabilities စစ်ဆေးမှုက Render Job မဖန်တီးပါ။

လုံခြုံရေး
---------
- Provider API Key ကို Browser/HTML ထဲ မထည့်ပါနှင့်။ Server Environment Variable ထဲမှာသာ သိမ်းပါ။
- HTTPS သုံးပါ။ CORS ကို ကိုယ်ပိုင် Website Origin တစ်ခုတည်း ခွင့်ပြုပါ။
- BACKEND_ACCESS_TOKEN ကို အခြားသူနှင့် မမျှဝေပါနှင့်။
- Starter သည် Job များကို Memory ထဲတွင်သာ သိမ်းသည်။ Server Restart လုပ်လျှင် Job စာရင်း ပျောက်နိုင်သည်။ Production အတွက် Database/Queue၊ durable job storage၊ monitoring၊ billing limits နှင့် provider-specific error handling ထည့်ရန်လိုသည်။
- Provider API စည်းမျဉ်းနှင့် ခွင့်ပြုချက်များကို လိုက်နာပါ။

Provider Adapter
----------------
provider.js ထဲတွင် isConfigured(), providerName(), submitRenderJob(), getRenderJob(), cancelRenderJob() ကို Provider API အလိုက် အကောင်အထည်ဖော်ပါ။ အကောင်အထည်မဖော်ရသေးလျှင် isConfigured() ကို false အတိုင်းထားပါ။ မမှန်ကန်သော Mock Success မပြန်ပါနှင့်။


V45 Provider Integration Contract
---------------------------------
GET /provider/contract returns the provider-neutral adapter contract. It does not
connect a vendor or indicate that rendering is ready. The adapter deliberately
remains unconfigured until a specific provider is selected and implemented using
that provider's official API documentation and authorized credentials.
Required methods: isConfigured, providerName, submitRenderJob, getRenderJob,
and cancelRenderJob. Cancellation support may be provider-dependent.


VERSION 44 - JOB မှတ်တမ်း အမြဲတမ်းသိမ်းဆည်းမှု
- Job မှတ်တမ်းများကို ./data/jobs.json ထဲတွင် သိမ်းဆည်းသည်။
- Server ပြန်စချိန်တွင် ဖိုင်မှ Job များကို ပြန်ဖတ်သည်။
- JOBS_DATA_FILE ဖြင့် သိမ်းမည့်ဖိုင်နေရာ ပြောင်းနိုင်သည်။
- JSON ဖိုင်ကို ပုံမှန် Backup လုပ်ပါ။ Disk ပျက်ခြင်းမှ အလိုအလျောက်ကာကွယ်ပေးခြင်း မဟုတ်ပါ။
- JSON file store သည် Starter အဆင့်သာဖြစ်သည်။ Production အတွက် transaction ပါသော database နှင့် queue သုံးပါ။
- Provider Adapter မရှိသေးလျှင် Render မစတင်ပါ။


Version 45 အသစ်
- GET /jobs ကို Bearer Token ဖြင့် ခေါ်ပြီး Render Job မှတ်တမ်းများကို စာမျက်နှာလိုက် ကြည့်နိုင်သည်။
- Query: limit (1-100), offset (0 နှင့်အထက်), status (queued/processing/completed/failed/cancelled)။
- Response တွင် items နှင့် pagination.total/hasMore ပါဝင်သည်။ Provider API ကို မခေါ်ဘဲ သိမ်းထားသော မှတ်တမ်းကိုသာ ပြန်ပေးသည်။


==============================
VERSION 46 — OPENROUTER VIDEO ADAPTER
==============================

ဒီ Version မှာ OpenRouter ရဲ့ တရားဝင် Video Generation API နဲ့ ချိတ်နိုင်တဲ့ Adapter ပါဝင်ပါတယ်။ Provider API Key မရှိသေးလျှင် Render အစစ် မစတင်နိုင်ပါ။ ဒီ ZIP ကိုယ်တိုင်က API Key မဖန်တီးပေးပါ။

လိုအပ်တဲ့ Environment Variable များ (.env)
- VIDEO_PROVIDER=openrouter
- OPENROUTER_API_KEY= (လျှို့ဝှက် API Key ကို Backend Server ထဲမှာသာ ထည့်ရန်)
- VIDEO_MODEL= (GET /provider/models မှ ရရှိတဲ့ Model ID တစ်ခုကို ရွေးရန်)
- VIDEO_RESOLUTION=720p (ရွေးထားသော Model က ပံ့ပိုးရမည်)
- VIDEO_ASPECT_RATIO=9:16 (Scene Pack ရဲ့ frameFormat နဲ့ ကိုက်ညီရမည်)

တပ်ဆင်ပုံ
1. .env.example ကို .env အဖြစ် ကူးပါ။
2. BACKEND_ACCESS_TOKEN, CORS_ORIGIN ကို ကိုယ့် Server အတွက် သတ်မှတ်ပါ။
3. OpenRouter API ချိတ်ဆက်မှုနဲ့ အသုံးပြုခွင့်ကို အကောင့်ပိုင်ရှင်/အုပ်ထိန်းသူက စစ်ဆေးပြီးမှ API Key ကို OPENROUTER_API_KEY ထဲ Server ဘက်တွင်သာ ထည့်ပါ။
4. VIDEO_MODEL ကို မရွေးရသေးလျှင် အရင်ဆုံး Server စတင်ပြီးနောက် App ရဲ့ Provider Setup ကနေ Model စာရင်းကို ရယူပါ။ ထိုအခါ .env ထဲမှာ ရွေးချယ်ထားတဲ့ Model ID ကို ဖြည့်ပြီး Server ကို Restart လုပ်ပါ။
5. App ရဲ့ Render Server ချိတ်ဆက်မှုထဲတွင် Backend URL နဲ့ Backend Access Token ထည့်ပါ။ V46 Provider Setup မှာ “Provider ချိတ်ဆက်မှု စမ်းရန်” ကို နှိပ်ပါ။
6. Model ရဲ့ supportedDurations, supportedAspectRatios, supportedResolutions ကို စစ်ပါ။ Scene အားလုံးရဲ့ duration/ratio/resolution မကိုက်လျှင် Render ကို Backend က ပယ်ချပါမယ်။
7. Render ပို့မီ Provider ရဲ့ လက်ရှိဈေးနှုန်း၊ မော်ဒယ်အသုံးပြုခွင့်၊ အကောင့်စည်းကမ်းများကို အကောင့်ပိုင်ရှင်/အုပ်ထိန်းသူက စစ်ဆေးပါ။ Scene တစ်ခန်းစီအတွက် သီးခြား Video Job ပို့ပါတယ်။ ကုန်ကျစရိတ် ဖြစ်နိုင်ပါတယ်။

API Endpoint များ
- GET /provider/test (Backend Token လိုအပ်) — API Key နဲ့ ရွေးထားသော Model ကို စစ်ဆေးသည်။ Render မစတင်ပါ။
- GET /provider/models (Backend Token လိုအပ်) — Video Model စာရင်း၊ duration/ratio/resolution နဲ့ pricing metadata ပြသည်။ Render မစတင်ပါ။
- POST /jobs — Scene တစ်ခန်းစီကို OpenRouter သို့ သီးခြားတင်ပို့သည်။
- GET /jobs/:jobId — Scene Job အားလုံးရဲ့ အခြေအနေကို စစ်ဆေးသည်။

ကန့်သတ်ချက်များ
- ဒီ Adapter မှာ Provider Job Cancel ကို မပံ့ပိုးသေးပါ။ Cancel Endpoint က HTTP 501 ပြန်ပေးပါမယ်။
- Model တစ်ခုချင်းစီရဲ့ Duration/Aspect Ratio/Resolution မတူပါ။ Scene တစ်ခန်းစီ 4 စက္ကန့်ဟု သတ်မှတ်ထားသော်လည်း Provider Model က 4s မပံ့ပိုးလျှင် အဲဒီ Model နဲ့ Render မရပါ။
- Provider က အချို့ Scene များကို လက်ခံပြီး နောက်တစ်ခန်းမှာ error ဖြစ်လျှင် Partial Submission အဖြစ် Job ID ပြန်ပေးနိုင်သည်။ Job မှတ်တမ်းကို စစ်ဆေးပါ။
- Provider ရဲ့ Output URL များ သက်တမ်းကုန်နိုင်သည်။ လိုအပ်သော Output ကို အကောင့်ပိုင်ရှင်က သတ်မှတ်ထားသည့် လုံခြုံသော Storage ထဲသို့ သိမ်းရန်လိုနိုင်သည်။
- OpenRouter API Key ကို HTML, Browser Local Storage, Git Repository သို့ မထည့်ပါနှင့်။ Key ပေါက်ကြားပါက ချက်ချင်း revoke လုပ်ပါ။

API အချက်အလက်အရင်းအမြစ် — OpenRouter Official Video Generation API: https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request
