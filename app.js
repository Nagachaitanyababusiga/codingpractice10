const express = require('express')
const app = express()
app.use(express.json())
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

let db = null

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

const initializeServerAndDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, (request, response) => {
      console.log('The server is Up and running')
    })
  } catch (e) {
    console.log(`DBERROR: ${e.message}`)
    process.exit(1)
  }
}

initializeServerAndDB()

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const q_1 = `
  select * from user where username = '${username}';
  `
  const dbreturn = await db.get(q_1)
  if (dbreturn === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbreturn.password)
    if (isPasswordCorrect) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'SECRET')
      response.send({
        jwtToken: jwtToken,
      })
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//authentication token
const stateAuthenticationToken = (request, response, next) => {
  const val = request.headers['authorization']
  if (val === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    const token = val.split(' ')[1]
    jwt.verify(token, 'SECRET', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//API-1
//get list of states
app.get('/states/', stateAuthenticationToken, async (request, response) => {
  const dbquery = `
    SELECT state_id as stateId,state_name as stateName,population FROM state;
  `
  const data = await db.all(dbquery)
  response.send(data)
})

//API-2
//get a particular state
app.get(
  '/states/:stateId/',
  stateAuthenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const dbquery = `
    SELECT state_id as stateId,state_name as stateName,population FROM state where state_id = ${stateId};
  `
    const data = await db.get(dbquery)
    response.send(data)
  },
)

//API-3
//post a district
app.post('/districts/', stateAuthenticationToken, async (request, response) => {
  const req_obj = request.body
  const {districtName, stateId, cases, cured, active, deaths} = req_obj
  const dbquery = `
    insert into district (district_name,state_id,cases,cured,active,deaths) values('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `
  await db.run(dbquery)
  response.send('District Successfully Added')
})

//API-4
//get a district with districtid
app.get(
  '/districts/:districtId/',
  stateAuthenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const dbquery = `
    SELECT district_id as districtId,district_name as districtName,state_id as stateId,cases,cured,active,deaths FROM district where district_id = ${districtId};
  `
    const data = await db.get(dbquery)
    response.send(data)
  },
)

//API-5
//delete a district
app.delete(
  '/districts/:districtId/',
  stateAuthenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const dbquey = `
  delete from district where district_id = ${districtId};
  `
    await db.run(dbquey)
    response.send('District Removed')
  },
)

//API-6
app.put(
  '/districts/:districtId/',
  stateAuthenticationToken,
  async (request, response) => {
    const req_obj = request.body
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = req_obj
    const dbquery = `
    update district set
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    where district_id=${districtId};
      `
    await db.run(dbquery)
    response.send('District Details Updated')
  },
)

//API-7
//returns based on stateId
app.get(
  '/states/:stateId/stats',
  stateAuthenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const query = `
  select sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,
  sum(deaths) as totalDeaths from district group by state_id having state_id=${stateId};
  `
    const val = await db.get(query)
    response.send(val)
  },
)

//API-8
app.get(
  '/districts/:districtId/details/',
  stateAuthenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const q = `
    select state_name as stateName from state inner join district
    on state.state_id=district.state_id where district.district_id = ${districtId}; 
  `
    const val = await db.get(q)
    response.send(val)
  },
)

module.exports = app
