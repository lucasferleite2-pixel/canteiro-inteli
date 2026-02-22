import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { type, data } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "diary_summary") {
      systemPrompt = `Você é um engenheiro civil sênior especializado em gestão de obras. Analise os registros de diário de obra fornecidos e gere:
1. **Resumo Executivo**: Síntese das atividades do período em 3-5 frases.
2. **Indicadores**: Média de equipe em campo, dias com clima adverso, principais atividades recorrentes.
3. **Alertas e Riscos**: Ocorrências relevantes, atrasos identificados, problemas de materiais.
4. **Recomendações**: Sugestões práticas para melhorar produtividade e mitigar riscos.
Responda sempre em português brasileiro, de forma objetiva e profissional. Use markdown para formatação.`;

      const entries = data.entries || [];
      const projectName = data.projectName || "Obra";
      userPrompt = `Projeto: ${projectName}\n\nRegistros do Diário de Obra (${entries.length} registros):\n\n${entries
        .map(
          (e: any, i: number) =>
            `--- Registro ${i + 1} (${e.entry_date}) ---\nClima: ${e.weather || "N/I"}\nEquipe: ${e.team_count || 0} pessoas\nAtividades: ${e.activities || "N/I"}\nOcorrências: ${e.occurrences || "N/I"}\nMateriais: ${e.materials || "N/I"}\nComentários Técnicos: ${e.technical_comments || "N/I"}`
        )
        .join("\n\n")}`;
    } else if (type === "contract_risk") {
      systemPrompt = `Você é um advogado especialista em contratos de construção civil e direito administrativo brasileiro. Analise o contrato fornecido e gere:
1. **Resumo do Contrato**: Partes, objeto, valor, prazo.
2. **Riscos Identificados**: Cláusulas que podem gerar problemas, prazos críticos, obrigações não cumpridas.
3. **Análise de Conformidade**: Verificação de conformidade com a Lei 14.133/2021 (Nova Lei de Licitações) quando aplicável.
4. **Recomendações**: Ações preventivas e corretivas sugeridas.
5. **Pontos de Atenção**: Datas críticas, garantias, multas, reajustes.
Responda sempre em português brasileiro, de forma objetiva e profissional. Use markdown para formatação.`;

      const contract = data.contract || {};
      userPrompt = `Contrato: ${contract.name || "Sem nome"}
Número: ${contract.contract_number || "N/I"}
Status: ${contract.status || "N/I"}
Valor: R$ ${contract.value ? Number(contract.value).toLocaleString("pt-BR") : "N/I"}
Início: ${contract.start_date || "N/I"}
Término: ${contract.end_date || "N/I"}
Descrição: ${contract.description || "N/I"}
Obrigações: ${JSON.stringify(contract.obligations || [])}`;
    } else {
      return new Response(JSON.stringify({ error: "Tipo de análise inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
