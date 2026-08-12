export type MotoboyRole = "suporte" | "recepcao" | "none";

export type TipoServicoMotoboy = "ENTREGA" | "Retirada";
export type RetornoMotoboy = "Sim" | "Não";
export type PrioridadeMotoboy = "Baixa" | "Normal" | "Alta" | "Urgente";

export interface MotoboyRequest {
  id: string;
  nomeSolicitante: string;
  dataSolicitacao: string;
  equipamento: string;
  funcionario: string;
  email: string;
  centroCusto: string;
  telefone: string;
  endereco: string;
  tipoServico: TipoServicoMotoboy;
  possuiRetorno: RetornoMotoboy;
  prioridade: PrioridadeMotoboy;
  maquinaRetirada?: string;
  enviado?: string;
  recebido?: string;
  dataEnvioRecebimento?: string;
  codigoRastreio?: string;
  observacoes?: string;
  status?: "Pendente" | "Pendente de recebimento" | "Em andamento" | "Concluído" | "Excluído";
  justificativaExclusao?: string;
  excluidoPor?: string;
  excluidoEm?: string;
}

export type MotoboyCreatePayload = Pick<
  MotoboyRequest,
  | "nomeSolicitante"
  | "dataSolicitacao"
  | "equipamento"
  | "funcionario"
  | "email"
  | "centroCusto"
  | "telefone"
  | "endereco"
  | "tipoServico"
  | "possuiRetorno"
  | "prioridade"
>;

export type MotoboyUpdatePayload = Pick<
  MotoboyRequest,
  | "maquinaRetirada"
  | "enviado"
  | "recebido"
  | "dataEnvioRecebimento"
  | "codigoRastreio"
  | "observacoes"
>;
