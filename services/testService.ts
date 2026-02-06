
import { dataService } from './dataService';
import { TestResult, CallType, ProtocolStatus, UserRole } from '../types';

export const testService = {
  runAllTests: async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    
    // 1. Teste de Geocodificação
    results.push(await testService.testGeocoding());
    
    // 2. Teste de Importação e Deduplicação (Mock)
    results.push(await testService.testImportDeduplication());
    
    // 3. Teste de Fluxo de Protocolo
    results.push(await testService.testProtocolCycle());
    
    // 4. Teste de Salvamento de Chamada
    results.push(await testService.testCallSaving());

    return results;
  },

  testGeocoding: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const addr = "Avenida Paulista, 1000, São Paulo, SP";
      const coords = await dataService.geocodeAddress(addr);
      if (coords && coords.lat !== 0) {
        return { id: 'geo-1', name: 'Geocodificação de Endereço', status: 'passed', duration: Date.now() - start };
      }
      throw new Error("Coordenadas retornadas inválidas");
    } catch (e: any) {
      return { id: 'geo-1', name: 'Geocodificação de Endereço', status: 'failed', error: e.message };
    }
  },

  testImportDeduplication: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      // Simula modo staging para não afetar DB real
      dataService.setStagingMode(true);
      dataService.clearStagingData();
      
      const phone = "11999999999";
      await dataService.upsertClient({ name: "Teste 1", phone });
      await dataService.upsertClient({ name: "Teste Duplicado", phone });
      
      const clients = await dataService.getClients();
      if (clients.length === 1 && clients[0].name === "Teste Duplicado") {
        return { id: 'import-1', name: 'Importação e Deduplicação', status: 'passed', duration: Date.now() - start };
      }
      throw new Error(`Deveria ter 1 cliente, mas tem ${clients.length}`);
    } catch (e: any) {
      return { id: 'import-1', name: 'Importação e Deduplicação', status: 'failed', error: e.message };
    }
  },

  testProtocolCycle: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      dataService.setStagingMode(true);
      const now = new Date().toISOString();
      const mockProto = {
        openedByOperatorId: 'mock-admin',
        ownerOperatorId: 'mock-admin',
        departmentId: 'tecnico',
        title: 'Teste QA',
        description: 'Desc',
        priority: 'Alta' as any,
        status: ProtocolStatus.ABERTO,
        openedAt: now,
        updatedAt: now,
        slaDueAt: now,
        clientId: 'mock-c-1'
      } as any;
      
      await dataService.saveProtocol(mockProto, 'mock-admin');
      const protos = await dataService.getProtocols();
      const p = protos.find(pr => pr.title === 'Teste QA');
      
      if (!p) throw new Error("Protocolo não salvo");
      
      await dataService.updateProtocol(p.id, { status: ProtocolStatus.FECHADO }, 'mock-admin', 'QA Finalizado');
      const updated = await dataService.getProtocols();
      if (updated.find(pr => pr.id === p.id)?.status === ProtocolStatus.FECHADO) {
        return { id: 'proto-1', name: 'Ciclo de Vida do Protocolo', status: 'passed', duration: Date.now() - start };
      }
      throw new Error("Falha ao atualizar status");
    } catch (e: any) {
      return { id: 'proto-1', name: 'Ciclo de Vida do Protocolo', status: 'failed', error: e.message };
    }
  },

  testCallSaving: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      dataService.setStagingMode(true);
      const call = {
        operatorId: 'mock-admin',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 10,
        reportTime: 0,
        responses: { q1: 'Sim' },
        type: CallType.POS_VENDA
      } as any;
      
      await dataService.saveCall(call);
      const calls = await dataService.getCalls();
      if (calls.length > 0) {
        return { id: 'call-1', name: 'Salvamento de Atendimento', status: 'passed', duration: Date.now() - start };
      }
      throw new Error("Chamada não registrada");
    } catch (e: any) {
      return { id: 'call-1', name: 'Salvamento de Atendimento', status: 'failed', error: e.message };
    }
  }
};
