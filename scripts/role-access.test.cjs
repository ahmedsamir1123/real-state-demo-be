const assert = require('node:assert/strict')
const test = require('node:test')
const { Types } = require('mongoose')
const { User } = require('../dist/db/model/user/user.model')
const { project } = require('../dist/db/model/project/project.model')
const { OfferService } = require('../dist/modules/offer/offer.service')
const { ProjectService } = require('../dist/modules/project/project.service')
const { AuthService } = require('../dist/modules/auth/auth.service')
const { authorize } = require('../dist/modules/auth/auth.middleware')
const authRouter = require('../dist/modules/auth/auth.controller').default
const projectRouter = require('../dist/modules/project/project.controller').default
const offerRouter = require('../dist/modules/offer/offer.controller').default

const managerId = new Types.ObjectId()
const salesId = new Types.ObjectId()
const response = () => ({ status() { return this }, json(value) { return value } })

test('manager sees own and assigned sales offers; department manager sees all', async () => {
  const originalFind = User.find
  let teamQuery
  User.find = (query) => {
    teamQuery = query
    return { select: () => ({ lean: async () => [{ _id: salesId }] }) }
  }
  try {
    const service = new OfferService()
    let filter
    service.offerRepository.getAll = async (value) => { filter = value; return [] }
    await service.get({ user: { id: String(managerId), role: 'manager' } }, response())
    assert.equal(teamQuery.role, 'sales')
    assert.equal(String(teamQuery.managerId), String(managerId))
    assert.deepEqual(filter.createdBy.$in.map(String), [String(managerId), String(salesId)])

    await service.get({ user: { id: String(salesId), role: 'sales' } }, response())
    assert.equal(String(filter.createdBy), String(salesId))

    await service.get({ user: { id: String(managerId), role: 'department_manager' } }, response())
    assert.deepEqual(filter, {})
  } finally {
    User.find = originalFind
  }
})

test('editing an offer cannot approve it and managers can only edit their own offers', async () => {
  const service = new OfferService()
  service.offerRepository.getOne = async () => ({ project: new Types.ObjectId(), customerPlan: {}, financialInputs: {} })
  service.applyDiscountPolicy = async (value) => value
  let filter
  let update
  service.offerRepository.update = async (nextFilter, nextUpdate) => {
    filter = nextFilter
    update = nextUpdate
    return { status: 'pending_approval' }
  }
  await service.update({
    params: { id: String(new Types.ObjectId()) },
    user: { id: String(managerId), role: 'manager' },
    body: { status: 'approved', approvedAt: new Date(), calculationResult: { accepted: false } },
  }, response())
  assert.equal(String(filter.createdBy), String(managerId))
  assert.equal(update.$set.status, 'pending_manager_review')
  assert.equal(update.$set.approvedAt, undefined)
  assert.equal(update.$unset.approvedAt, 1)
})

test('the saved customer rate is 10.5% and an offer below its base value is rejected', async () => {
  const originalFindById = project.findById
  const planId = new Types.ObjectId()
  project.findById = () => ({ select: () => ({ lean: async () => ({ paymentPlans: [{ _id: planId, name: 'Plan', code: 'PLAN', annualDiscountRate: 14, customerDiscountPct: 75, requiredCollectionPct: 50 }] }) }) })
  try {
    const service = new OfferService()
    const input = (customerPlanNpv, collectedAtHandoverPct = 0.5) => ({
      project: new Types.ObjectId(),
      projectPaymentPlan: { sourceId: planId, name: 'Plan' },
      financialInputs: { annualDiscountRate: 99 },
      customerPlan: { discountPct: 0 },
      calculationResult: { basePlanNpv: 1_000_000, customerPlanNpv, collectedAtHandoverPct, accepted: false, collectionPassed: false },
    })
    const within = await service.applyDiscountPolicy(input(1_000_000))
    assert.equal(within.calculationResult.customerBenefitUsedPct, 75)
    assert.equal(within.calculationResult.customerDiscountLimitPct, 10.5)
    assert.equal(within.calculationResult.customerXnpvRatePct, 10.5)
    assert.equal(within.projectPaymentPlan.customerXnpvRatePct, 10.5)
    assert.equal(within.calculationResult.minimumAcceptableNpv, 1_000_000)
    assert.equal(within.calculationResult.displayedCustomerNpv, 1_000_000)
    assert.equal(within.calculationResult.npvDifference, 0)
    assert.equal(within.calculationResult.npvPassed, true)
    assert.equal(within.calculationResult.collectionPassed, true)
    assert.equal(within.calculationResult.accepted, true)
    assert.equal(within.financialInputs.annualDiscountRate, 14)
    assert.equal(within.financialInputs.requiredCollectionPct, 50)
    const belowFloor = await service.applyDiscountPolicy(input(993_300))
    assert.equal(belowFloor.calculationResult.npvPassed, false)
    assert.equal(belowFloor.calculationResult.accepted, false)
    const lowCollection = await service.applyDiscountPolicy(input(1_000_000, 0.457))
    assert.equal(lowCollection.calculationResult.npvPassed, true)
    assert.equal(lowCollection.calculationResult.collectionPassed, false)
    assert.equal(lowCollection.calculationResult.accepted, false)
  } finally {
    project.findById = originalFindById
  }
})

test('manager review forwards an exception to admin and cannot make the final decision', async () => {
  const originalFind = User.find
  User.find = () => ({ select: () => ({ lean: async () => [{ _id: salesId }] }) })
  try {
    const service = new OfferService()
    let filter
    let update
    service.offerRepository.update = async (nextFilter, nextUpdate) => {
      filter = nextFilter
      update = nextUpdate
      return { status: 'pending_approval' }
    }
    await service.review({ params: { id: String(new Types.ObjectId()) }, user: { id: String(managerId), role: 'manager' }, body: { recommendation: 'rejected' } }, response())
    assert.deepEqual(filter.createdBy.$in.map(String), [String(managerId), String(salesId)])
    assert.equal(filter.status, 'pending_manager_review')
    assert.equal(update.$set.status, 'pending_approval')
    assert.equal(update.$set.managerRecommendation, 'rejected')
  } finally {
    User.find = originalFind
  }
})

test('only admin passes the exception decision authorization', () => {
  const gate = authorize('admin')
  let error
  gate({ user: { role: 'manager' } }, {}, (reason) => { error = reason })
  assert.equal(error?.statusCode, 403)
  gate({ user: { role: 'department_manager' } }, {}, (reason) => { error = reason })
  assert.equal(error?.statusCode, 403)
  gate({ user: { role: 'admin' } }, {}, (reason) => { error = reason })
  assert.equal(error, undefined)
})

test('only managers can submit a review and admin cannot decide before review', async () => {
  const reviewRoute = offerRouter.stack.find((layer) => layer.route?.path === '/:id/review')?.route
  assert.ok(reviewRoute)
  const gate = reviewRoute.stack[0].handle
  let error
  gate({ user: { role: 'sales' } }, {}, (reason) => { error = reason })
  assert.equal(error?.statusCode, 403)
  gate({ user: { role: 'admin' } }, {}, (reason) => { error = reason })
  assert.equal(error?.statusCode, 403)
  gate({ user: { role: 'manager' } }, {}, (reason) => { error = reason })
  assert.equal(error, undefined)

  const service = new OfferService()
  service.offerRepository.getOne = async () => ({ status: 'pending_manager_review', calculationResult: { accepted: false } })
  await assert.rejects(
    service.decide({ params: { id: String(new Types.ObjectId()) }, user: { id: String(new Types.ObjectId()), role: 'admin' }, body: { decision: 'approved' } }, response()),
    /manager review/
  )
})

test('project creation, editing and deletion require admin', () => {
  for (const method of ['post', 'put', 'delete']) {
    const route = projectRouter.stack.find((layer) => layer.route?.methods[method])?.route
    assert.ok(route, `${method} project route exists`)
    const gate = route.stack[0].handle
    let error
    gate({ user: { role: 'manager' } }, {}, (reason) => { error = reason })
    assert.equal(error?.statusCode, 403)
    gate({ user: { role: 'admin' } }, {}, (reason) => { error = reason })
    assert.equal(error, undefined)
  }
})

test('discount policy details require admin', () => {
  const route = projectRouter.stack.find((layer) => layer.route?.path === '/:id/payment-plans/:planId/discount-policy')?.route
  assert.ok(route, 'discount policy route exists')
  const gate = route.stack[0].handle
  for (const role of ['sales', 'manager', 'department_manager']) {
    let error
    gate({ user: { role } }, {}, (reason) => { error = reason })
    assert.equal(error?.statusCode, 403)
  }
  let error
  gate({ user: { role: 'admin' } }, {}, (reason) => { error = reason })
  assert.equal(error, undefined)
})

test('sales receives only the customer discount while admin receives margin details', async () => {
  const route = projectRouter.stack.find((layer) => layer.route?.path === '/:id/payment-plans/:planId/discount-margin')?.route
  assert.ok(route, 'discount margin route exists')
  const gate = route.stack[0].handle
  for (const role of ['manager', 'department_manager']) {
    let error
    gate({ user: { role } }, {}, (reason) => { error = reason })
    assert.equal(error?.statusCode, 403)
  }

  const planId = new Types.ObjectId()
  const service = new ProjectService()
  service.projectRepository.getOne = async () => ({ paymentPlans: [{ _id: planId, customerDiscountPct: 75 }] })
  const invoke = async (role, basePlanXnpv, customerOfferXnpv) => {
    const res = { status() { return this }, json(value) { this.value = value; return value } }
    await service.calculateDiscountMargin({ params: { id: String(new Types.ObjectId()), planId: String(planId) }, user: { role }, body: { basePlanXnpv, customerOfferXnpv } }, res)
    return res.value.data
  }

  const sales = await invoke('sales', 6587281, 7156067)
  assert.deepEqual(Object.keys(sales), ['maximumCustomerDiscount'])
  assert.equal(sales.maximumCustomerDiscount, 426589.5)

  const admin = await invoke('admin', 6587281, 7156067)
  assert.equal(admin.xnpvGain, 568786)
  assert.equal(admin.maximumCustomerDiscount, 426589.5)
  assert.equal(admin.adminRemainingShare, 142196.5)
  assert.equal(admin.customerDiscountPercentage, 75)
  assert.equal(admin.adminRemainingPercentage, 25)
  const reversed = await invoke('admin', 6725834, 6694770)
  assert.equal(reversed.xnpvGain, 31064)
  assert.equal(reversed.maximumCustomerDiscount, 23298)
  assert.equal(reversed.adminRemainingShare, 7766)
  assert.equal((await invoke('sales', 100, 100)).maximumCustomerDiscount, 0)
  assert.equal((await invoke('sales', 101, 100)).maximumCustomerDiscount, 0.75)
  assert.equal((await invoke('sales', 100, 101)).maximumCustomerDiscount, 0.75)
})

test('user editing is admin only and saves table changes', async () => {
  const route = authRouter.stack.find((layer) => layer.route?.path === '/users/:id' && layer.route.methods.patch)?.route
  assert.ok(route)
  const gate = route.stack[1].handle
  let error
  gate({ user: { role: 'department_manager' } }, {}, (reason) => { error = reason })
  assert.equal(error?.statusCode, 403)
  gate({ user: { role: 'admin' } }, {}, (reason) => { error = reason })
  assert.equal(error, undefined)

  const originalFindById = User.findById
  const originalExists = User.exists
  const originalUpdate = User.findByIdAndUpdate
  const userId = new Types.ObjectId()
  let update
  User.findById = async () => ({ _id: userId, id: String(userId), name: 'Old', email: 'old@mail.com', role: 'sales' })
  User.exists = async () => false
  User.findByIdAndUpdate = async (_id, changes) => {
    update = changes
    return { id: String(userId), name: changes.$set.name, email: changes.$set.email, role: 'sales' }
  }
  try {
    const service = new AuthService()
    const result = await service.updateUser({ params: { id: String(userId) }, user: { id: String(new Types.ObjectId()), role: 'admin' }, body: { name: 'New', email: ' NEW@MAIL.COM ', role: 'sales', managerId: null } }, response())
    assert.equal(update.$set.name, 'New')
    assert.equal(update.$set.email, 'new@mail.com')
    assert.equal(update.$unset.managerId, 1)
    assert.equal(result.data.name, 'New')
  } finally {
    User.findById = originalFindById
    User.exists = originalExists
    User.findByIdAndUpdate = originalUpdate
  }
})
