export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string | null
          project_id: string | null
          read_at: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message?: string | null
          project_id?: string | null
          read_at?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          project_id?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          checklist: Json | null
          company_id: string
          created_at: string
          deadline: string | null
          edital_number: string | null
          estimated_value: number | null
          id: string
          notes: string | null
          opening_date: string | null
          project_id: string | null
          proposal_value: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          checklist?: Json | null
          company_id: string
          created_at?: string
          deadline?: string | null
          edital_number?: string | null
          estimated_value?: number | null
          id?: string
          notes?: string | null
          opening_date?: string | null
          project_id?: string | null
          proposal_value?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          checklist?: Json | null
          company_id?: string
          created_at?: string
          deadline?: string | null
          edital_number?: string | null
          estimated_value?: number | null
          id?: string
          notes?: string | null
          opening_date?: string | null
          project_id?: string | null
          proposal_value?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          brand_color: string | null
          cnpj: string | null
          crea_cau: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string | null
          technical_responsible: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          brand_color?: string | null
          cnpj?: string | null
          crea_cau?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          technical_responsible?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          brand_color?: string | null
          cnpj?: string | null
          crea_cau?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          technical_responsible?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          company_id: string
          contract_number: string | null
          created_at: string
          description: string | null
          documents: Json | null
          end_date: string | null
          id: string
          name: string
          obligations: Json | null
          project_id: string | null
          start_date: string | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          company_id: string
          contract_number?: string | null
          created_at?: string
          description?: string | null
          documents?: Json | null
          end_date?: string | null
          id?: string
          name: string
          obligations?: Json | null
          project_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          company_id?: string
          contract_number?: string | null
          created_at?: string
          description?: string | null
          documents?: Json | null
          end_date?: string | null
          id?: string
          name?: string
          obligations?: Json | null
          project_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          activities: string | null
          author_id: string
          company_id: string
          created_at: string
          entry_date: string
          id: string
          is_locked: boolean | null
          materials: string | null
          occurrences: string | null
          photos: Json | null
          project_id: string
          team_count: number | null
          technical_comments: string | null
          updated_at: string
          weather: string | null
        }
        Insert: {
          activities?: string | null
          author_id: string
          company_id: string
          created_at?: string
          entry_date?: string
          id?: string
          is_locked?: boolean | null
          materials?: string | null
          occurrences?: string | null
          photos?: Json | null
          project_id: string
          team_count?: number | null
          technical_comments?: string | null
          updated_at?: string
          weather?: string | null
        }
        Update: {
          activities?: string | null
          author_id?: string
          company_id?: string
          created_at?: string
          entry_date?: string
          id?: string
          is_locked?: boolean | null
          materials?: string | null
          occurrences?: string | null
          photos?: Json | null
          project_id?: string
          team_count?: number | null
          technical_comments?: string | null
          updated_at?: string
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_photos: {
        Row: {
          activity: string | null
          captured_at: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          description: string | null
          diary_entry_id: string
          file_name: string
          file_size: number | null
          id: string
          latitude: number | null
          longitude: number | null
          mime_type: string | null
          project_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          activity?: string | null
          captured_at?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          diary_entry_id: string
          file_name: string
          file_size?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mime_type?: string | null
          project_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          activity?: string | null
          captured_at?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          diary_entry_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mime_type?: string | null
          project_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_photos_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_photos_diary_entry_id_fkey"
            columns: ["diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_records: {
        Row: {
          amount: number
          category: string | null
          centro_custo: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          invoice_url: string | null
          origem: string
          paid_at: string | null
          previsto_no_orcamento: boolean | null
          project_id: string | null
          rdo_despesa_item_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          centro_custo?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          origem?: string
          paid_at?: string | null
          previsto_no_orcamento?: boolean | null
          project_id?: string | null
          rdo_despesa_item_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          centro_custo?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          origem?: string
          paid_at?: string | null
          previsto_no_orcamento?: boolean | null
          project_id?: string | null
          rdo_despesa_item_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_rdo_despesa_item_id_fkey"
            columns: ["rdo_despesa_item_id"]
            isOneToOne: false
            referencedRelation: "rdo_despesa_item"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_acao_corretiva: {
        Row: {
          analise_tecnica: string
          company_id: string
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          fase: string | null
          id: string
          impacto_estimado: number | null
          motivo: string
          nivel_urgencia: string
          obra_id: string
          status: string
          tipo_acao: string
        }
        Insert: {
          analise_tecnica: string
          company_id: string
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          fase?: string | null
          id?: string
          impacto_estimado?: number | null
          motivo: string
          nivel_urgencia: string
          obra_id: string
          status?: string
          tipo_acao: string
        }
        Update: {
          analise_tecnica?: string
          company_id?: string
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          fase?: string | null
          id?: string
          impacto_estimado?: number | null
          motivo?: string
          nivel_urgencia?: string
          obra_id?: string
          status?: string
          tipo_acao?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_acao_corretiva_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_acao_corretiva_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_fase_planejamento: {
        Row: {
          company_id: string
          created_at: string
          custo_planejado: number
          fase: string
          id: string
          obra_id: string
          quantidade_planejada: number
          unidade: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custo_planejado?: number
          fase: string
          id?: string
          obra_id: string
          quantidade_planejada?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custo_planejado?: number
          fase?: string
          id?: string
          obra_id?: string
          quantidade_planejada?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_fase_planejamento_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_fase_planejamento_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          budget: number | null
          company_id: string
          created_at: string
          description: string | null
          expected_end_date: string | null
          id: string
          municipality: string | null
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          budget?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          expected_end_date?: string | null
          id?: string
          municipality?: string | null
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          budget?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          expected_end_date?: string | null
          id?: string
          municipality?: string | null
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_atividade: {
        Row: {
          company_id: string
          concluida: boolean | null
          created_at: string
          descricao: string
          etapa_planejamento_id: string | null
          hora: string | null
          id: string
          impacto_cronograma: string | null
          rdo_dia_id: string
          tipo_atividade: string
          vinculada_ao_planejamento: boolean | null
        }
        Insert: {
          company_id: string
          concluida?: boolean | null
          created_at?: string
          descricao: string
          etapa_planejamento_id?: string | null
          hora?: string | null
          id?: string
          impacto_cronograma?: string | null
          rdo_dia_id: string
          tipo_atividade?: string
          vinculada_ao_planejamento?: boolean | null
        }
        Update: {
          company_id?: string
          concluida?: boolean | null
          created_at?: string
          descricao?: string
          etapa_planejamento_id?: string | null
          hora?: string | null
          id?: string
          impacto_cronograma?: string | null
          rdo_dia_id?: string
          tipo_atividade?: string
          vinculada_ao_planejamento?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_atividade_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_atividade_rdo_dia_id_fkey"
            columns: ["rdo_dia_id"]
            isOneToOne: false
            referencedRelation: "rdo_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_audit_log: {
        Row: {
          action: string
          changes: Json | null
          company_id: string
          created_at: string
          id: string
          rdo_dia_id: string
          user_id: string
          version: number | null
        }
        Insert: {
          action: string
          changes?: Json | null
          company_id: string
          created_at?: string
          id?: string
          rdo_dia_id: string
          user_id: string
          version?: number | null
        }
        Update: {
          action?: string
          changes?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          rdo_dia_id?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_audit_log_rdo_dia_id_fkey"
            columns: ["rdo_dia_id"]
            isOneToOne: false
            referencedRelation: "rdo_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_despesa_item: {
        Row: {
          afeta_curva_financeira: boolean | null
          centro_custo: string | null
          company_id: string
          created_at: string
          created_by: string
          descricao: string
          id: string
          incluir_no_pdf: boolean | null
          observacao: string | null
          previsto_no_orcamento: boolean | null
          quantidade: number
          rdo_dia_id: string
          tipo: string
          unidade: string | null
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          afeta_curva_financeira?: boolean | null
          centro_custo?: string | null
          company_id: string
          created_at?: string
          created_by: string
          descricao: string
          id?: string
          incluir_no_pdf?: boolean | null
          observacao?: string | null
          previsto_no_orcamento?: boolean | null
          quantidade?: number
          rdo_dia_id: string
          tipo?: string
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          afeta_curva_financeira?: boolean | null
          centro_custo?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          descricao?: string
          id?: string
          incluir_no_pdf?: boolean | null
          observacao?: string | null
          previsto_no_orcamento?: boolean | null
          quantidade?: number
          rdo_dia_id?: string
          tipo?: string
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "rdo_despesa_item_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_despesa_item_rdo_dia_id_fkey"
            columns: ["rdo_dia_id"]
            isOneToOne: false
            referencedRelation: "rdo_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_dia: {
        Row: {
          clima: string
          company_id: string
          created_at: string
          criado_por: string
          custo_dia: number | null
          data: string
          equipe_total: number
          fase_obra: string | null
          hash_integridade: string | null
          horas_trabalhadas: number | null
          id: string
          is_locked: boolean | null
          numero_sequencial: number | null
          obra_id: string
          observacoes_gerais: string | null
          percentual_fisico_acumulado: number | null
          percentual_fisico_dia: number | null
          produtividade_percentual: number | null
          quantidade_executada: number | null
          risco_dia: string | null
          unidade_medicao: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          clima?: string
          company_id: string
          created_at?: string
          criado_por: string
          custo_dia?: number | null
          data?: string
          equipe_total?: number
          fase_obra?: string | null
          hash_integridade?: string | null
          horas_trabalhadas?: number | null
          id?: string
          is_locked?: boolean | null
          numero_sequencial?: number | null
          obra_id: string
          observacoes_gerais?: string | null
          percentual_fisico_acumulado?: number | null
          percentual_fisico_dia?: number | null
          produtividade_percentual?: number | null
          quantidade_executada?: number | null
          risco_dia?: string | null
          unidade_medicao?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          clima?: string
          company_id?: string
          created_at?: string
          criado_por?: string
          custo_dia?: number | null
          data?: string
          equipe_total?: number
          fase_obra?: string | null
          hash_integridade?: string | null
          horas_trabalhadas?: number | null
          id?: string
          is_locked?: boolean | null
          numero_sequencial?: number | null
          obra_id?: string
          observacoes_gerais?: string | null
          percentual_fisico_acumulado?: number | null
          percentual_fisico_dia?: number | null
          produtividade_percentual?: number | null
          quantidade_executada?: number | null
          risco_dia?: string | null
          unidade_medicao?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_dia_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_dia_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_foto: {
        Row: {
          atividade_relacionada_id: string | null
          company_id: string
          created_at: string
          data_captura: string | null
          descricao: string | null
          fase_obra: string | null
          file_name: string
          hash_integridade: string | null
          id: string
          latitude: number | null
          longitude: number | null
          rdo_dia_id: string
          storage_path: string
          tag_risco: string | null
          uploaded_by: string
        }
        Insert: {
          atividade_relacionada_id?: string | null
          company_id: string
          created_at?: string
          data_captura?: string | null
          descricao?: string | null
          fase_obra?: string | null
          file_name: string
          hash_integridade?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          rdo_dia_id: string
          storage_path: string
          tag_risco?: string | null
          uploaded_by: string
        }
        Update: {
          atividade_relacionada_id?: string | null
          company_id?: string
          created_at?: string
          data_captura?: string | null
          descricao?: string | null
          fase_obra?: string | null
          file_name?: string
          hash_integridade?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          rdo_dia_id?: string
          storage_path?: string
          tag_risco?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_foto_atividade_relacionada_id_fkey"
            columns: ["atividade_relacionada_id"]
            isOneToOne: false
            referencedRelation: "rdo_atividade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_foto_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_foto_rdo_dia_id_fkey"
            columns: ["rdo_dia_id"]
            isOneToOne: false
            referencedRelation: "rdo_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_material: {
        Row: {
          centro_custo: string | null
          company_id: string
          created_at: string
          fase_relacionada: string | null
          gera_alerta_desequilibrio: boolean | null
          id: string
          item: string
          previsto_em_orcamento: boolean | null
          quantidade: number | null
          rdo_dia_id: string
          tipo: string
          unidade: string | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          centro_custo?: string | null
          company_id: string
          created_at?: string
          fase_relacionada?: string | null
          gera_alerta_desequilibrio?: boolean | null
          id?: string
          item: string
          previsto_em_orcamento?: boolean | null
          quantidade?: number | null
          rdo_dia_id: string
          tipo?: string
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          centro_custo?: string | null
          company_id?: string
          created_at?: string
          fase_relacionada?: string | null
          gera_alerta_desequilibrio?: boolean | null
          id?: string
          item?: string
          previsto_em_orcamento?: boolean | null
          quantidade?: number | null
          rdo_dia_id?: string
          tipo?: string
          unidade?: string | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_material_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_material_rdo_dia_id_fkey"
            columns: ["rdo_dia_id"]
            isOneToOne: false
            referencedRelation: "rdo_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_ocorrencia: {
        Row: {
          company_id: string
          created_at: string
          descricao: string
          gera_alerta: boolean | null
          gera_risco_contratual: boolean | null
          id: string
          impacto: string | null
          rdo_dia_id: string
          responsavel: string | null
          tipo_ocorrencia: string
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao: string
          gera_alerta?: boolean | null
          gera_risco_contratual?: boolean | null
          id?: string
          impacto?: string | null
          rdo_dia_id: string
          responsavel?: string | null
          tipo_ocorrencia?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string
          gera_alerta?: boolean | null
          gera_risco_contratual?: boolean | null
          id?: string
          impacto?: string | null
          rdo_dia_id?: string
          responsavel?: string | null
          tipo_ocorrencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_ocorrencia_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_ocorrencia_rdo_dia_id_fkey"
            columns: ["rdo_dia_id"]
            isOneToOne: false
            referencedRelation: "rdo_dia"
            referencedColumns: ["id"]
          },
        ]
      }
      report_verifications: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string
          entries_count: number | null
          generated_at: string
          generated_by: string | null
          id: string
          integrity_hash: string
          metadata: Json | null
          project_id: string | null
          project_name: string
          report_id: string
          report_type: string
          short_hash: string
          technical_responsible: string | null
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          entries_count?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          integrity_hash: string
          metadata?: Json | null
          project_id?: string | null
          project_name: string
          report_id: string
          report_type?: string
          short_hash: string
          technical_responsible?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          entries_count?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          integrity_hash?: string
          metadata?: Json | null
          project_id?: string | null
          project_name?: string
          report_id?: string
          report_type?: string
          short_hash?: string
          technical_responsible?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_verifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_in_company: { Args: { _company_id: string }; Returns: boolean }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      user_company_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "engineer"
        | "foreman"
        | "financial"
        | "legal"
        | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "engineer",
        "foreman",
        "financial",
        "legal",
        "client",
      ],
    },
  },
} as const
