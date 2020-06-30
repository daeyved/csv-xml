// Import modules
const csv = require('csv-parser')
const fs = require('fs')
const { create } = require('xmlbuilder2')

/*
    using a supplied CSV this function maps the old
    category ID's to the new SFCC versions
*/
const createCatMap = () => {
    let catMap = [];
    // get the csv, load into csv parser
    // and iterate through the nodes
    fs.createReadStream('in/catmapping.csv')
    .pipe(csv())
    .on('data', (data) => {
        catMap.push({'new':data.Category,'old':data['Magento IDs']})
    })
    .on('end', () => {
        convertCSV(catMap)
    });
  }

/*
    Usinf csv-parser convert the csv into an object
    and use this as a basis to create a new object with the same
    node structure as SF XML
    The use xmlBuilder to convert the object to an XML string
*/
const convertCSV = (catMap) => {
    let product
    // set up the object skeleton
    let xmlBuild = {
            catalog: {
                '@xmlns': 'http://www.demandware.com/xml/impex/catalog/2006-10-31',
                '@catalog-id': 'VAM_MasterShop',
                'product': []
            }
        }
    // get the csv, load into csv parser
    // and iterate through the nodes
    fs.createReadStream('in/standardproducts.csv')
    .pipe(csv())
    .on('data', (data) => {
      //set the default properties
        product = {
        '@product-id': data.SKU,
        'display-name': {
            '@xml:lang': 'x-default',
            '#text': data['Product Title']
        },
        'images': {
            'image-group': {
                '@view-type': 'hi-res',
                image: []
            }
        },
        'custom-attributes': {
            'custom-attribute': []
        },
        'online-flag': 'true',
        'available-flag': 'true',
        'searchable-flag': 'true'
      }

      // set the conditional properties
      if(data['Product Description']) {
        product['short-description'] = product['long-description'] = {
            '@xml:lang': 'x-default',
            '#text': data['Product Description']
        }
      }

      if(data['Webstore Brand Name']) {
        product['brand'] = {
            '#text': data['Webstore Brand Name']
        }
      }

      if(data['Webstore Category1']) {
        let sfccCat = catMap.filter(x => x.old === data['Webstore Category1']),
            classCat
        if(sfccCat.length > 0) {
            classCat = sfccCat[0].new
        }
        product['classification-category'] = {
            '#text': classCat
        }
      }

      if(data['Webstore Custom Text 2']) {
        let vpd = {
            '@attribute-id': 'vamProductDimensions',
            '#text': data['Webstore Custom Text 2']
        }
        product['custom-attributes']['custom-attribute'].push(vpd)
      }

      if(data['Webstore Custom Text 3']) {
        let vsa = {
            '@attribute-id': 'vamShopAuthor',
            '#text': data['Webstore Custom Text 3']
        }
        product['custom-attributes']['custom-attribute'].push(vsa)
      }

      if(data['Webstore Custom Text 4']) {
        const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        let dateStr = ''
        if(data['Webstore Custom Text 4'].includes('-')){
            let cYear = new Date().getFullYear()
            let dateParts = data['Webstore Custom Text 4'].split('-')
            let day = dateParts[0]
            let month = months.indexOf(dateParts[1].toLowerCase()) + 1
            month = month <= 9 ? `0${month}` : month
            let year = parseInt(dateParts[2]) + 2000
            year = year > cYear ? year-100 : year
            dateStr = `${year}-${month}-${day}`
        } else {
            dateStr = `${data['Webstore Custom Text 4']}-01-01`
        }
        let vsd = {
            '@attribute-id': 'vamShopDateOfWork',
            '#text': dateStr
        }
        product['custom-attributes']['custom-attribute'].push(vsd)
      }

      if(data['Webstore BulletPoint5']) {
        let vpc = {
            '@attribute-id': 'vamProductComposition',
            '#text': data['Webstore BulletPoint5']
        }
        let vsm = {
            '@attribute-id': 'vamShopMaterial',
            '#text': data['Webstore BulletPoint5']
        }
        product['custom-attributes']['custom-attribute'].push(vpc, vsm)
      }

     // get all possible images
      for(let i=1, img, imgPath;i<9;i++) {
          if(data[`Additional Image ${i}`]) {
            imgPath = 'hi-res/' + data[`Additional Image ${i}`].split('/').slice(-1)[0]
            img = {
                '@path': imgPath
            }
            product.images['image-group'].image.push(img)
          } else {
              if(i===1) {
                  delete product.images
              }
              break;
          }
      }

      xmlBuild.catalog.product.push(product)
  })
  .on('end', () => {
    let writer = fs.createWriteStream('out/standardproducts.xml');
    const doc = create(xmlBuild);
    const docString = doc.toString({ prettyPrint: true })
    writer.write(docString);
  });
}

createCatMap()