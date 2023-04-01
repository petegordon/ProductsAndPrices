const puppeteer = require("puppeteer");
const fs = require('fs');


(async () => {


    console.log("START::" + new Date().toISOString())

    let start = new Date();

    process.on('uncaughtException', async function (err) {
        console.error('UNCAUGHT EXCEPTION - keeping process alive:', err);
    });
    process.on('unhandledRejection', async function (err, promise) {
        console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });


    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto("https://www.capitalcityonlineauction.com/");
    await page.waitForSelector('#AuctionList')

    console.log("Page Title:")
    console.log(await page.title())

    let auctionLinks = await page.$$eval('.Auction-main', auctions =>
        auctions.map((el) => {
            return {
                "name": el.querySelector('.text-body').innerText,
                "link": el.querySelector('[href^="/Public"]').href,
                "start": ((el.querySelectorAll('.local-date-time')[0]) ? el.querySelectorAll('.local-date-time')[0].innerText.trim() : ''),
                "end": ((el.querySelectorAll('.local-date-time')[1]) ? el.querySelectorAll('.local-date-time')[1].innerText.trim() : '')
            }
        }))


    let auctionData = []
    let json_db_file = new Date().toISOString() + '_capitalcity_database.json'
    fs.writeFileSync(json_db_file, '[]')

    try {
        for (const { name, link, start, end } of auctionLinks) {

            auctionData = JSON.parse(fs.readFileSync(json_db_file))
            //GOTO Individual Auction
            await Promise.all([
                page.goto(link),
                page.waitForNavigation()
            ]);

            //View Items in Individual Auction
            //await page.click('[href$="category/ALL"]')
            await page.waitForSelector('[href^="/Public/Auction/AuctionItems"]')
            //let auctionItemLink = await page.$('[href^="/Public/Auction/AuctionItems"]')

            let auctionItemLink = await page.$eval('[href^="/Public/Auction/AuctionItems"]', auctionItemLink =>
                auctionItemLink.href
            )
            console.log(auctionItemLink)
            await Promise.all([
                page.goto(auctionItemLink),
                page.waitForNavigation()
            ]);

            console.log('...click to see aution items')

            await page.waitForSelector('.BidAuctionItemId')
            //Read Items
            let auctionItems = await page.$$eval('.BidAuctionItemId + div',
                itemRows => itemRows.map((tr) => {
                    return {
                        "item_image_url": (tr.querySelector('img')) ? tr.querySelector('img').src : null,
                        "item_title": (tr.querySelector('.auction-Itemlist-Title')) ? (tr.querySelector('.auction-Itemlist-Title').innerText) : null,
                        "item_desc": tr.innerText,
                        "item_url": (tr.querySelector('.auction-Itemlist-Title a')) ? (tr.querySelector('.auction-Itemlist-Title a').href) : null,
                        "item_current_price": (tr.querySelector('[id^="CurrentBidAmount_"]')) ? tr.querySelector('[id^="CurrentBidAmount_"]').innerText : null,
                        "download_datetime": new Date().toISOString()
                    }
                }))

            currentAuction = {
                name: name,
                link: link,
                start: start,
                end: end,
                items: auctionItems
            }

            console.log('...first set of aution items complete')


            //Are there more pages of Items?
            //let countOfPages = (await page.$$('[name="page"]:not([type=hidden])')).length
            let countOfPages = await page.$eval('.pagination-popover .popover-total', (el) => {
                return parseInt(el.innerText)
            }
            )
            console.log('countOfPages: ' + countOfPages)
            for (let i = 1; i < countOfPages; i++) {
                //GOTO Next Page of Items
                let pageNum = i + 1
                console.log('...going to page:' + pageNum)
                //let pageClick = await page.$(`[name="page"][value="p${pageNum}"]:not([type=hidden])`)            

                await page.$eval(`[href="/Public/Auction/GetAuctionItems?page=${pageNum}"]`, (el) => {
                    el.click()
                })

                await page.waitForTimeout(2000)
                //let pageClick = await await page.$(`[href="/Public/Auction/GetAuctionItems?page=${pageNum}"]`)
                //console.log(pageClick)
                //await pageClick.click()
                //await page.waitForNavigation()

                await page.waitForSelector('.BidAuctionItemId')
                //Read Items
                let auctionItems = await page.$$eval('.BidAuctionItemId + div',
                    itemRows => itemRows.map((tr) => {
                        return {
                            "item_image_url": (tr.querySelector('img')) ? tr.querySelector('img').src : null,
                            "item_title": (tr.querySelector('.auction-Itemlist-Title')) ? (tr.querySelector('.auction-Itemlist-Title').innerText) : null,
                            "item_desc": tr.innerText,
                            "item_url": (tr.querySelector('.auction-Itemlist-Title a')) ? (tr.querySelector('.auction-Itemlist-Title a').href) : null,
                            "item_current_price": (tr.querySelector('[id^="CurrentBidAmount_"]')) ? tr.querySelector('[id^="CurrentBidAmount_"]').innerText : null,
                            "download_datetime": new Date().toISOString()
                        }
                    }))

                currentAuction.items = currentAuction.items.concat(auctionItems)
            }

            auctionData.push(currentAuction)

            console.log(new Date() + "::ADDED TO DB::" + currentAuction.name)

            fs.writeFileSync(json_db_file, JSON.stringify(auctionData, null, 2))

        }
    } catch (err) {
        console.log(err)
    }

    console.log("END::" + new Date().toISOString())
    console.log("duration:" + (new Date() - start))
    // await page.screenshot({ path: "example.png" });

    //await browser.close();
})();