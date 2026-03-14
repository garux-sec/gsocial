# Gsocial - Social Listening Dashboard

แอปพลิเคชันสำหรับดึงข้อมูล คัดกรอง และวิเคราะห์ความรู้สึก (Sentiment Analysis) จาก Facebook Pages, ข่าวสาร, และแพลตฟอร์ม Social Media อื่นๆ โดยประยุกต์ใช้ **Google Gemini AI** ร่วมกับ **Apify**

## โครงสร้างระบบ (Architecture)
- **Frontend**: Vue.js 3 + Tailwind CSS (Vite)
- **Backend**: Node.js + Express
- **Architecture**: ระบบถูกออกแบบให้ Backend ทำหน้าที่ Serve ไฟล์ Static ของ Frontend ไปพร้อมกันใน **Port เดียวกัน (5050)** ทำให้ง่ายต่อการนำขึ้น Server จริง

---

## 🚀 การนำขึ้นระบบจริง (Production Server)

คำแนะนำนี้สำหรับการนำโค้ดไปรันบน VPS / Server ที่ใช้ระบบปฏิบัติการ **Ubuntu/Linux** ผ่านโปรแกรม PM2 และมีการตั้งค่ารับ Request จากที่อยู่โดเมน (เช่น ผ่าน Cloudflare)

### 1. เข้าสู่ Server และติดตั้ง NodeJS
SSH เข้าสู่เซิร์ฟเวอร์ของคุณ จากนั้นรันคำสั่งเพื่ออัปเดตระบบและติดตั้ง Node.js
```bash
sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. นำ Source Code เข้า Server
นำโค้ดในโปรเจกต์นี้ทั้งหมดไปไว้บน Server (เช่น ผ่าน `git clone`)
```bash
git clone https://github.com/garux-sec/gsocial.git
cd gsocial
```

*(หมายเหตุ: โค้ดในโฟลเดอร์ \`client/dist\` จำเป็นต้องถูก Build มาให้เรียบร้อยแล้วด้วยคำสั่ง `npm run build` ในฝั่ง Client ซึ่งปัจจุบันบน Github ตัว Client น่าจะโดน Build ไว้เรียบร้อยแล้ว)*

### 3. ติดตั้ง Dependencies ฝั่ง Backend
เข้าไปที่โฟลเดอร์ \`server\` และติดตั้งไลบรารีต่างๆ ที่จำเป็น
```bash
cd server
npm install
```

### 4. สร้างและตั้งค่าไฟล์ `.env` ในโฟลเดอร์ Server
ระบบจำเป็นต้องใช้ API Keys ในการทำงาน สร้างไฟล์ตัวแปรแวดล้อม:
```bash
nano .env
```
คัดลอกค่าต่อไปนี้และแทนที่ด้วย Key จริงของคุณ:
```env
PORT=5050
GEMINI_API_KEY=your_gemini_key
GOOGLE_API_KEY=your_google_search_key
APIFY_API_TOKEN=your_apify_token
```
กด `Ctrl + X` เพื่อออก, กด `Y` กด `Enter` เพื่อเซฟ

### 5. ติดตั้ง PM2 และสั่งรันระบบ
PM2 (Process Manager 2) จะช่วยให้ระบบ Node.js ทำงานอยู่เบื้องหลังได้ตลอดเวลา แม้เราจะปิดหน้าจอ Terminal ไปแล้ว และจัดการรีสตาร์ทตัวเองเมื่อ Error
```bash
# ติดตั้ง PM2 แบบ Global
sudo npm install -g pm2

# รัน Server ด้วย PM2
pm2 start server.js --name "gsocial_backend"
```
เสร็จแล้วบันทึกให้ PM2 เปิดตัวเองหลัง Server ปิด/เปิดใหม่ (Reboot)
```bash
pm2 startup
pm2 save
```

---

## 🌐 การตั้งค่า Cloudflare Proxy (ใช้งานร่วมกับ Port 5050)

หลังจากทำตามขั้นตอนด้านบนเสร็จ ระบบของคุณจะทำงานอยู่ที่ `http://ip-ของเซิฟเวอร์:5050`
เพื่อให้สามารถเข้าเว็บไซต์ผ่านชื่อโดเมนหลัก (เช่น `https://gsocial.g4rux.com`) ได้อย่างปลอดภัย โดยไม่ต้องพิมพ์พอร์ตต่อท้าย:

1. เข้าไปที่ **Cloudflare Dashboard** เลือกโดเมนของคุณ
2. ไปที่เมนู **DNS**
   - เพิ่ม `A Record` ให้ชี้ชื่อโดเมนย่อยไปที่ **IP Address** ของเซิร์ฟเวอร์
   - **สำคัญ:** ต้องเปิดเมฆสีส้ม (Proxy Status เป็น Proxied)
3. ไปที่เมนู **Rules > Origin Rules** เลื่อนลงมากด **Create Rule**
   - **Rule name**: (ตั้งชื่ออะไรก็ได้ เช่น `Route to 5050`)
   - เลือกวงกลม **Custom rule**
   - ในกล่อง Field ให้เลือก: **Hostname**
   - ในกล่อง Operator ให้เลือก: **equals**
   - ในกล่อง Value ให้พิมพ์: โดเมนของคุณ (เช่น `gsocial.g4rux.com`)
   - เลื่อนลงมาด้านล่างที่หัวข้อ **Destination port**
   - เลือกตัวเลือก **Rewrite to** แล้วกรอกช่องด้านขวาเป็น **5050**
4. กด **Deploy**

> เพียงเท่านี้ เมื่อมีคนเข้าเว็บผ่าน HTTPS ระบบของ Cloudflare จะวิ่งเข้ามาหาเชิร์ฟเวอร์ของคุณที่ Port 5050 ตามปกติ โดยไม่ต้องเปิด Port ผสมหน้าเว็บหรือเพิ่มการคอนฟิก Nginx/Apache ที่ยุ่งยากครับ

---

## เกร็ดเพิ่มเติม
- **ดูบันทึก (Logs):** คุณสามารถดู Log ว่าระบบทำงานปกติไหมด้วยคำสั่ง `pm2 logs gsocial_backend`
- **Restart ระบบ:** ถังแก้โค้ดหรือเปลี่ยน .env จะใช้คำสั่ง `pm2 restart gsocial_backend`
