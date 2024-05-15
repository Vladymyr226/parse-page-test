const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

;(async () => {
  const url = 'https://www.tus.si/#s2'
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle2' })

    await new Promise((resolve) => setTimeout(resolve, 10000))

    console.log('Починаємо перевірку контенту сторінки...')

    const catalogs = await page.evaluate(() => {
      const catalogElements = document.querySelectorAll('.list-item')
      console.log(`Знайдено ${catalogElements.length} елементів з класом .list-item`)
      const catalogData = []

      catalogElements.forEach((element, index) => {
        console.log(`Обробляємо елемент ${index + 1}`)
        const titleElement = element.querySelector('h3 a')
        const linkElement = element.querySelector('a.link-icon.pdf')
        const validityElements = element.querySelectorAll('time')

        if (titleElement && linkElement && validityElements.length === 2) {
          const title = titleElement.textContent.trim()
          const link = linkElement.href
          const validityStart = validityElements[0].textContent.trim()
          const validityEnd = validityElements[1].textContent.trim()

          catalogData.push({
            title,
            link,
            validity: `${validityStart} - ${validityEnd}`,
          })
        } else {
          console.log(`Елемент ${index + 1} не має потрібних піделементів`)
        }
      })

      return catalogData
    })

    if (catalogs.length === 0) {
      console.log('Не знайдено жодних каталогів.')
    } else {
      console.log('Знайдено каталоги:', catalogs)

      const jsonFilePath = path.join(__dirname, 'catalogs.json')
      fs.writeFileSync(jsonFilePath, JSON.stringify(catalogs, null, 2), 'utf8')

      console.log(`Інформацію збережено в файл: ${jsonFilePath}`)

      catalogs.forEach(async (catalog) => {
        const pdfPath = path.join(__dirname, 'catalogs', `${catalog.title}.pdf`)
        const writer = fs.createWriteStream(pdfPath)

        try {
          const response = await axios({
            url: catalog.link,
            method: 'GET',
            responseType: 'stream',
          })

          response.data.pipe(writer)

          writer.on('finish', () => {
            console.log(`Каталог завантажено: ${pdfPath}`)
          })

          writer.on('error', (err) => {
            console.error(`Помилка завантаження каталогу: ${catalog.title}`, err)
          })
        } catch (error) {
          console.error(`Помилка при завантаженні каталогу: ${catalog.title}`, error)
        }
      })
    }
  } catch (error) {
    console.error('Сталася помилка:', error)
  } finally {
    await browser.close()
  }
})()
