import 'dotenv/config'
import mongoose from 'mongoose'

if (!process.env.DB_URL) throw new Error('DB_URL is not configured')

await mongoose.connect(process.env.DB_URL)

try {
  const database = mongoose.connection.db
  if (!database) throw new Error('MongoDB connection is not ready')

  const projects = database.collection('projects')
  const units = database.collection('units')
  const cursor = projects.find({ $or: [{ paymentPlans: { $exists: false } }, { paymentPlans: { $size: 0 } }] })
  let migratedProjects = 0

  for await (const project of cursor) {
    const projectUnits = await units.find({ project: project._id, 'paymentPlans.0': { $exists: true } }).toArray()
    const plansByCode = new Map()

    for (const unit of projectUnits) {
      for (const plan of unit.paymentPlans || []) {
        const code = String(plan.code || '').trim().toUpperCase()
        if (code && !plansByCode.has(code)) plansByCode.set(code, plan)
      }
    }

    const paymentPlans = [...plansByCode.values()]
    if (!paymentPlans.length) continue

    const defaultIndex = Math.max(0, paymentPlans.findIndex((plan) => plan.isActive !== false && plan.isDefault))
    paymentPlans.forEach((plan, index) => {
      plan.isDefault = index === defaultIndex
      if (plan.isDefault) plan.isActive = true
    })

    await projects.updateOne({ _id: project._id }, { $set: { paymentPlans } })
    migratedProjects += 1
  }

  console.log(`Migrated payment plans to ${migratedProjects} project(s). Legacy unit fields were preserved.`)
} finally {
  await mongoose.disconnect()
}

