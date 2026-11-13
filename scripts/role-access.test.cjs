const assert = require('node:assert/strict')
const test = require('node:test')
const { Types } = require('mongoose')
const { User } = require('../dist/db/model/user/user.model')
const { project } = require('../dist/db/model/project/project.model')
const { OfferService } = require('../dist/modules/offer/offer.service')
const { authorize } = require('../dist/modules/auth/auth.middleware')
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

test('75% of a 14% XNPV rate allows 10.5% customer discount and flags 76%', async () => {
  const originalFindById = project.findById
  const planId = new Types.ObjectId()
  project.findById = () => ({ select: () => ({ lean: async () => ({ paymentPlans: [{ _id: planId, name: 'Plan', code: 'PLAN', annualDiscountRate: 14, customerDiscountPct: 75 }] }) }) })
  try {
    const service = new OfferService()
    const input = (discountPct) => ({
      project: new Types.ObjectId(),
      projectPaymentPlan: { sourceId: planId, name: 'Plan' },
      financialInputs: { annualDiscountRate: 99 },
      customerPlan: { discountPct },
      calculationResult: { accepted: true },
    })
    const within = await service.applyDiscountPolicy(input(10.5))
    assert.equal(within.calculationResult.discountLimitPassed, true)
    assert.equal(within.calculationResult.customerDiscountLimitPct, 10.5)
    assert.equal(within.calculationResult.customerBenefitUsedPct, 75)
    assert.equal(within.calculationResult.accepted, true)
    assert.equal(within.financialInputs.annualDiscountRate, 14)
    const exceeded = await service.applyDiscountPolicy(input(14 * 0.76))
    assert.equal(exceeded.calculationResult.discountLimitPassed, false)
    assert.equal(exceeded.calculationResult.customerBenefitUsedPct, 76)
    assert.equal(exceeded.calculationResult.accepted, false)
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
