const puppeteer = require("puppeteer");
const fs = require('fs');


(async () => {




    process.on('uncaughtException', async function (err) {
        console.error('UNCAUGHT EXCEPTION - keeping process alive:', err);
    });
    process.on('unhandledRejection', async function(err, promise) {
        console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });     


  const browser = await puppeteer.launch({headless:true});
  const page = await browser.newPage();
  await page.goto("https://www.capitalcityonlineauction.com/");
  await page.waitForSelector('#auction_title')

  console.log("Page Title:")
  console.log(await page.title())

  let auctionLinks = await page.$$eval('#auction_title', auctions => 
        auctions.map((el) => { return { "name":el.innerText, "link":el.parentNode.href} }))

  console.log(auctionLinks)

  let auctionData = []
  let json_db_file = 'capitalcity_database.json'

  for (const {name, link} of auctionLinks) {
    
    auctionData = JSON.parse(fs.readFileSync(json_db_file))
    //GOTO Individual Auction
    await Promise.all([
        page.goto(link),
        page.waitForNavigation()
    ]);

    //View Items in Individual Auction
    await page.click('[href$="category/ALL"]')  
    
    await page.waitForSelector('#DataTable tr')
    //Read Items
    let auctionItems = await page.$$eval('#DataTable tr', 
        itemRows => itemRows.map((tr) => {
            return { 
            "imgURL":(tr.querySelector('img'))?tr.querySelector('img').src:null, 
            "desc":(tr.querySelectorAll('td')[2])?tr.querySelectorAll('td')[2].innerHTML:null, 
            "price":(tr.querySelectorAll('td')[6])?tr.querySelectorAll('td')[6].innerText:null
            }
        }))

    currentAuction = {
        name:name,
        link:link,
        items:auctionItems
    }

    

    //Are there more pages of Items?
    let countOfPages = (await page.$$('[name="page"]:not([type=hidden])')).length
    for(let i=0; i<countOfPages; i++){
        //GOTO Next Page of Items
        let pageNum = i+2
        let pageClick = await page.$(`[name="page"][value="p${pageNum}"]:not([type=hidden])`)         
        await pageClick.click()
        await page.waitForNavigation()        

        await page.waitForSelector('#DataTable tr')
        auctionItems = await page.$$eval('#DataTable tr', 
            itemRows => itemRows.map((tr) => {
                return { 
                "imgURL":(tr.querySelector('img'))?tr.querySelector('img').src:null, 
                "desc":(tr.querySelectorAll('td')[2])?tr.querySelectorAll('td')[2].innerHTML:null, 
                "price":(tr.querySelectorAll('td')[6])?tr.querySelectorAll('td')[6].innerText:null
                }
            }))

        currentAuction.items = currentAuction.items.concat(auctionItems)
    }

    auctionData.push(currentAuction)

    console.log(new Date()+"::ADDED TO DB::"+currentAuction.name)

    fs.writeFileSync(json_db_file, JSON.stringify(auctionData, null, 2))    
    
  }

 // await page.screenshot({ path: "example.png" });

  //await browser.close();
})();