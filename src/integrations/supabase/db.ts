import { supabase } from './client';
import type { Database, Contract } from './types';

// Types
type Tables = Database['public']['Tables'];
type TableName = keyof Tables;

// Generic type for table rows
type TableRow<T extends TableName> = Tables[T]['Row'];
type TableInsert<T extends TableName> = Tables[T]['Insert'];
type TableUpdate<T extends TableName> = Tables[T]['Update'];

// Database service class
export class DatabaseService {
  // Companies
  static async getCompanies() {
    const { data, error } = await supabase
      .from('companies')
      .select('*');
    if (error) throw error;
    return data;
  }

  static async getCompanyById(companyId: string) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();
    if (error) throw error;
    return data;
  }

  // Users
  // getUserByEmail is deprecated: email is not in users table. Use Supabase Auth instead.

  static async createUser(userData: TableInsert<'users'>) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Job Descriptions
  static async getJobDescriptions(companyId: string) {
    const { data, error } = await supabase
      .from('job_descriptions')
      .select('*, criteria(*)')
      .eq('company_id', companyId);
    if (error) throw error;
    return data;
  }

  static async createJobDescription(jobData: TableInsert<'job_descriptions'>) {
    const { data, error } = await supabase
      .from('job_descriptions')
      .insert(jobData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Resumes
  static async getResumes(companyId: string) {
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data;
  }

  static async createResume(resumeData: TableInsert<'resumes'>) {
    const { data, error } = await supabase
      .from('resumes')
      .insert(resumeData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateResumeScores(resumeId: string, scores: any) {
    const { data, error } = await supabase
      .from('resumes')
      .update({ evaluation_scores: scores })
      .eq('resume_id', resumeId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Criteria
  static async getCriteria(companyId: string) {
    const { data, error } = await supabase
      .from('criteria')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return data;
  }

  static async createCriteria(criteriaData: TableInsert<'criteria'>) {
    const { data, error } = await supabase
      .from('criteria')
      .insert(criteriaData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Plans
  static async getPlans() {
    const { data, error } = await supabase
      .from('plans')
      .select('*');
    if (error) throw error;
    return data;
  }

  // Generic methods
  static async getById<T extends TableName>(
    table: T,
    id: string,
    idField: keyof TableRow<T>
  ) {
    const { data, error } = await supabase
      .from(table)
      .select('user_id, company_id, first_name, last_name, role, user_status, created_at')
      .eq(idField as string, id)
      .single();
    if (error) throw error;
    return data as TableRow<T>;
  }

  static async create<T extends TableName>(
    table: T,
    data: TableInsert<T>
  ) {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return result as TableRow<T>;
  }

  static async update<T extends TableName>(
    table: T,
    id: string,
    data: TableUpdate<T>,
    idField: keyof TableRow<T>
  ) {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq(idField as string, id)
      .select()
      .single();
    if (error) throw error;
    return result as TableRow<T>;
  }

  static async delete<T extends TableName>(
    table: T,
    id: string,
    idField: keyof TableRow<T>
  ) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(idField as string, id);
    if (error) throw error;
    return true;
  }
}

export async function fetchContracts() {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      clients (
        client_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createOrUpdateContract(contract: Partial<Contract> & { id?: string }) {
  if (contract.id) {
    const { data, error } = await supabase
      .from('contracts')
      .update(contract)
      .eq('id', contract.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('contracts')
      .insert(contract)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export async function deleteContract(id: string) {
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getActiveContract(client_id: string, date: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select()
    .eq('client_id', client_id)
    .lte('valid_from', date)
    .gte('valid_till', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
  return data || null;
}

export function calculateContractPrice({ 
  contract, 
  weightKg, 
  manualOverride 
}: { 
  contract: Contract | null;
  weightKg: number;
  manualOverride: number;
}) {
  if (!contract) return manualOverride;
  const price = contract.pricing_method === 'fixed'
    ? contract.fixed_price!
    : weightKg * contract.price_per_kg!;
  return Math.min(price, manualOverride);
}

export async function fetchClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('client_name');

  if (error) throw error;
  return data;
} 