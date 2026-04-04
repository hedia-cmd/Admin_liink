// @ts-nocheck
import supabase from './supabaseClient'   // ⟵ nouveau import

const sb = supabase // alias

const mapId = (row) => (row && !row.id && row.uuid ? { ...row, id: row.uuid } : row)
const withIds = (rows = []) => rows.map(mapId)

function applyFilter(query, filter) {
  if (!filter) return query
  for (const [k, v] of Object.entries(filter)) {
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'string') {
      query = v.includes('%') ? query.ilike(k, v) : query.eq(k, v)
    } else if (Array.isArray(v)) {
      query = query.in(k, v)
    } else {
      query = query.eq(k, v)
    }
  }
  return query
}

const dataProvider = {
  async getList(resource, params) {
    const { page, perPage } = params?.pagination || { page: 1, perPage: 25 }
    const sort = params?.sort || {}
    const field = sort.field || 'id'
    const asc = (sort.order || 'ASC').toUpperCase() === 'ASC'
    const from = (page - 1) * perPage
    const to = from + perPage - 1

    let q = sb.from(resource).select('*', { count: 'exact' })
    q = applyFilter(q, params?.filter)
    q = q.order(field, { ascending: asc }).range(from, to)

    const { data, error, count } = await q
    if (error) throw error
    return { data: withIds(data || []), total: count ?? (data ? data.length : 0) }
  },

  async getOne(resource, params) {
    let { data, error } = await sb.from(resource).select('*').eq('id', params.id).single()
    if (error) {
      const r2 = await sb.from(resource).select('*').eq('uuid', params.id).single()
      if (r2.error) throw error
      data = r2.data
    }
    return { data: mapId(data) }
  },

  async getMany(resource, params) {
    let { data, error } = await sb.from(resource).select('*').in('id', params.ids)
    if (error) {
      const r2 = await sb.from(resource).select('*').in('uuid', params.ids)
      if (r2.error) throw error
      data = r2.data
    }
    return { data: withIds(data || []) }
  },

  async getManyReference(resource, params) {
    const { target, id } = params
    let q = sb.from(resource).select('*', { count: 'exact' }).eq(target, id)
    q = applyFilter(q, params?.filter)
    const { data, error, count } = await q
    if (error) throw error
    return { data: withIds(data || []), total: count ?? (data ? data.length : 0) }
  },

  async create(resource, params) {
    const { data, error } = await sb.from(resource).insert(params.data).select().single()
    if (error) throw error
    return { data: mapId(data) }
  },

  async update(resource, params) {
    const payload = { ...params.data }; delete payload.id
    let { data, error } = await sb.from(resource).update(payload).eq('id', params.id).select().single()
    if (error) {
      const r2 = await sb.from(resource).update(payload).eq('uuid', params.id).select().single()
      if (r2.error) throw error
      data = r2.data
    }
    return { data: mapId(data) }
  },

  async delete(resource, params) {
    let { data, error } = await sb.from(resource).delete().eq('id', params.id).select().single()
    if (error) {
      const r2 = await sb.from(resource).delete().eq('uuid', params.id).select().single()
      if (r2.error) throw error
      data = r2.data
    }
    return { data: mapId(data) }
  },

  async updateMany(resource, params) {
    const { data, error } = await sb.from(resource).update(params.data).in('id', params.ids).select()
    if (error) throw error
    return { data: withIds(data || []).map(r => r.id) }
  },

  async deleteMany(resource, params) {
    const { data, error } = await sb.from(resource).delete().in('id', params.ids).select()
    if (error) throw error
    return { data: withIds(data || []).map(r => r.id) }
  },
}

export default dataProvider
