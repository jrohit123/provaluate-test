import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchClients, fetchContracts, createOrUpdateContract, deleteContract } from '@/integrations/supabase/db';
import type { Client, Contract } from '@/integrations/supabase/types';

const formSchema = z.object({
  client_id: z.string().uuid(),
  contact_person: z.string().min(1),
  contact_no: z.string().min(1),
  email: z.string().email(),
  pricing_method: z.enum(['fixed', 'per_weight']),
  fixed_price: z.number().nullable(),
  price_per_kg: z.number().nullable(),
  valid_from: z.date(),
  valid_till: z.date(),
});

type FormData = z.infer<typeof formSchema>;

export function ContractsSection() {
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<(Contract & { clients: { client_name: string } })[]>([]);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contact_person: '',
      contact_no: '',
      email: '',
      pricing_method: 'fixed',
      fixed_price: null,
      price_per_kg: null,
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (editingContract) {
      form.reset({
        ...editingContract,
        valid_from: new Date(editingContract.valid_from),
        valid_till: new Date(editingContract.valid_till),
      });
    }
  }, [editingContract]);

  async function loadData() {
    try {
      const [clientsData, contractsData] = await Promise.all([
        fetchClients(),
        fetchContracts(),
      ]);
      setClients(clientsData);
      setContracts(contractsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    }
  }

  async function onSubmit(data: FormData) {
    try {
      const contractData = {
        ...data,
        id: editingContract?.id,
        valid_from: format(data.valid_from, 'yyyy-MM-dd'),
        valid_till: format(data.valid_till, 'yyyy-MM-dd'),
      };

      await createOrUpdateContract(contractData);
      await loadData();
      form.reset();
      setEditingContract(null);
      toast.success('Contract saved successfully');
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('Failed to save contract');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteContract(id);
      await loadData();
      toast.success('Contract deleted successfully');
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast.error('Failed to delete contract');
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingContract ? 'Edit Contract' : 'New Contract'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={form.watch('client_id')}
                  onValueChange={(value) => form.setValue('client_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input {...form.register('contact_person')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_no">Contact Number</Label>
                <Input {...form.register('contact_no')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input {...form.register('email')} type="email" />
              </div>

              <div className="space-y-2">
                <Label>Pricing Method</Label>
                <RadioGroup
                  value={form.watch('pricing_method')}
                  onValueChange={(value) => {
                    form.setValue('pricing_method', value as 'fixed' | 'per_weight');
                    form.setValue('fixed_price', null);
                    form.setValue('price_per_kg', null);
                  }}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed">Fixed Price</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="per_weight" id="per_weight" />
                    <Label htmlFor="per_weight">Per Weight</Label>
                  </div>
                </RadioGroup>
              </div>

              {form.watch('pricing_method') === 'fixed' ? (
                <div className="space-y-2">
                  <Label htmlFor="fixed_price">Fixed Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    onChange={(e) => form.setValue('fixed_price', parseFloat(e.target.value))}
                    value={form.watch('fixed_price') || ''}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="price_per_kg">Price per KG</Label>
                  <Input
                    type="number"
                    step="0.01"
                    onChange={(e) => form.setValue('price_per_kg', parseFloat(e.target.value))}
                    value={form.watch('price_per_kg') || ''}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Valid From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !form.watch('valid_from') && 'text-muted-foreground'
                      )}
                    >
                      {form.watch('valid_from') ? (
                        format(form.watch('valid_from'), 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.watch('valid_from')}
                      onSelect={(date) => form.setValue('valid_from', date!)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Valid Till</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !form.watch('valid_till') && 'text-muted-foreground'
                      )}
                    >
                      {form.watch('valid_till') ? (
                        format(form.watch('valid_till'), 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.watch('valid_till')}
                      onSelect={(date) => form.setValue('valid_till', date!)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              {editingContract && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingContract(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit">
                {editingContract ? 'Update Contract' : 'Create Contract'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contracts List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Pricing Method</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Valid Period</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell>{contract.clients.client_name}</TableCell>
                  <TableCell>{contract.contact_person}</TableCell>
                  <TableCell className="capitalize">{contract.pricing_method}</TableCell>
                  <TableCell>
                    {contract.pricing_method === 'fixed'
                      ? `₹${contract.fixed_price}`
                      : `₹${contract.price_per_kg}/kg`}
                  </TableCell>
                  <TableCell>
                    {format(new Date(contract.valid_from), 'dd/MM/yyyy')} -{' '}
                    {format(new Date(contract.valid_till), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingContract(contract)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(contract.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 