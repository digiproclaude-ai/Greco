-- Starter category tree, taxonomy and marketplace settings. This is data, not code: admins
-- edit, reorder, deactivate and extend all of it in the admin area (D-02).

create temp table starter_categories (slug text, parent_slug text, name text, short_description text, icon_key text, sort_order int);
insert into starter_categories values
  ('ai-agents-automation', null, 'AI agents & automation', 'Agents and workflows that run multi-step work across your tools', 'bot', 10),
  ('autonomous-agents', 'ai-agents-automation', 'Autonomous agents', 'Agents that plan and act on their own within clear limits', null, 10),
  ('workflow-automation', 'ai-agents-automation', 'Workflow automation', 'Automations built with tools like n8n, Make and Zapier', null, 20),
  ('business-process-automation', 'ai-agents-automation', 'Business process automation', 'Automating repetitive back-office processes', null, 30),
  ('chatbots-assistants', null, 'Chatbots & assistants', 'Support and internal assistants grounded in your data', 'message-square', 20),
  ('customer-support-chatbots', 'chatbots-assistants', 'Customer support chatbots', 'Assistants that answer customers on your site and channels', null, 10),
  ('knowledge-assistants', 'chatbots-assistants', 'Knowledge base assistants', 'Assistants that answer from your documents (RAG)', null, 20),
  ('internal-copilots', 'chatbots-assistants', 'Internal copilots', 'Assistants that help your team inside its tools', null, 30),
  ('voice-agents-phone', null, 'Voice agents & phone automation', 'Answer, route and book calls automatically', 'phone', 30),
  ('ai-receptionists', 'voice-agents-phone', 'AI receptionists', 'Answer calls, book appointments and hand over to staff', null, 10),
  ('outbound-calling-agents', 'voice-agents-phone', 'Outbound calling agents', 'Reminders, follow-ups and qualification calls', null, 20),
  ('speech-recognition', 'voice-agents-phone', 'Speech recognition & transcription', 'Turn calls and meetings into text', null, 30),
  ('generative-ai-apps', null, 'Generative AI applications', 'Products built on large language and image models', 'layers', 40),
  ('llm-applications', 'generative-ai-apps', 'LLM-powered applications', 'Apps and features built on language models', null, 10),
  ('content-generation', 'generative-ai-apps', 'Content generation systems', 'Pipelines that draft, adapt and check content', null, 20),
  ('image-video-generation', 'generative-ai-apps', 'Image & video generation', 'Custom image, video and design generation', null, 30),
  ('ai-integrations', null, 'AI integrations & APIs', 'Connect AI models to your existing systems', 'plug', 50),
  ('llm-api-integrations', 'ai-integrations', 'LLM API integrations', 'Add model APIs to your product or workflows', null, 10),
  ('crm-erp-integrations', 'ai-integrations', 'CRM & ERP integrations', 'AI inside the tools your teams already use', null, 20),
  ('data-science-analytics', null, 'Data science & analytics', 'Forecasting, dashboards and decision models', 'chart-column', 60),
  ('forecasting', 'data-science-analytics', 'Forecasting & predictive analytics', 'Predict demand, churn and other outcomes', null, 10),
  ('bi-dashboards', 'data-science-analytics', 'BI & dashboards', 'Dashboards and reporting your team will use', null, 20),
  ('data-engineering', 'data-science-analytics', 'Data engineering & pipelines', 'Clean, reliable data for analytics and AI', null, 30),
  ('machine-learning', null, 'Machine learning & deep learning', 'Custom models trained for your problem', 'brain-circuit', 70),
  ('custom-models', 'machine-learning', 'Custom model development', 'Models designed and trained for your data', null, 10),
  ('model-fine-tuning', 'machine-learning', 'Model fine-tuning', 'Adapt existing models to your domain', null, 20),
  ('recommendation-systems', 'machine-learning', 'Recommendation systems', 'Personalised recommendations and ranking', null, 30),
  ('computer-vision', null, 'Computer vision', 'Inspection, document reading and image analysis', 'scan-eye', 80),
  ('document-ai', 'computer-vision', 'Document AI & OCR', 'Extract data from documents and forms', null, 10),
  ('visual-inspection', 'computer-vision', 'Visual inspection & detection', 'Detect objects, defects and events in images and video', null, 20),
  ('natural-language-processing', null, 'Natural language processing', 'Understand, classify and transform text', 'languages', 90),
  ('text-classification', 'natural-language-processing', 'Classification & extraction', 'Sort, tag and extract information from text', null, 10),
  ('translation-localization', 'natural-language-processing', 'Translation & localization', 'Machine translation with quality checks', null, 20),
  ('ai-websites-saas', null, 'AI websites, apps & SaaS', 'Web products with AI at their core', 'app-window', 100),
  ('ai-saas-development', 'ai-websites-saas', 'AI SaaS development', 'Build an AI-first software product', null, 10),
  ('ai-powered-websites', 'ai-websites-saas', 'AI-powered websites', 'Websites with search, assistants and personalisation', null, 20),
  ('ai-infrastructure-mlops', null, 'AI infrastructure & MLOps', 'Deploy, scale and monitor AI in production', 'server', 110),
  ('model-deployment', 'ai-infrastructure-mlops', 'Model deployment & serving', 'Run models reliably and cost-effectively', null, 10),
  ('monitoring-observability', 'ai-infrastructure-mlops', 'Monitoring & observability', 'Track quality, cost and drift in production', null, 20),
  ('ai-security-evaluation', null, 'AI security & evaluation', 'Test AI systems for quality, safety and security', 'shield-check', 120),
  ('llm-evaluation', 'ai-security-evaluation', 'LLM evaluation', 'Measure answer quality with evaluation sets', null, 10),
  ('red-teaming', 'ai-security-evaluation', 'Red-teaming & safety testing', 'Probe AI systems for misuse and failure modes', null, 20),
  ('ai-marketing-advertising', null, 'AI marketing & advertising', 'AI for campaigns, content and growth', 'megaphone', 130),
  ('marketing-automation', 'ai-marketing-advertising', 'Marketing automation', 'Personalised campaigns and lead handling', null, 10),
  ('ad-optimization', 'ai-marketing-advertising', 'Ad creative & optimization', 'Generate and test ad creative at scale', null, 20),
  ('ai-strategy-consulting', null, 'AI strategy & consulting', 'Where AI fits, roadmaps and readiness reviews', 'compass', 140),
  ('ai-roadmaps', 'ai-strategy-consulting', 'AI strategy & roadmaps', 'Find and prioritise valuable AI opportunities', null, 10),
  ('ai-governance-compliance', 'ai-strategy-consulting', 'AI governance & compliance', 'Policies, risk reviews and regulatory readiness', null, 20),
  ('ai-research-development', null, 'AI research & development', 'Prototypes and research for new AI capabilities', 'flask-conical', 150),
  ('ai-education-training', null, 'AI education & training', 'Workshops and training for teams', 'graduation-cap', 160);

insert into public.categories (slug, icon_key, sort_order)
select slug, icon_key, sort_order from starter_categories where parent_slug is null
on conflict do nothing;
insert into public.categories (parent_id, slug, icon_key, sort_order)
select parent.id, s.slug, s.icon_key, s.sort_order
  from starter_categories s
  join public.categories parent on parent.slug = s.parent_slug and parent.parent_id is null
 where s.parent_slug is not null
on conflict do nothing;
insert into public.category_translations (category_id, locale, name, short_description)
select c.id, 'en', s.name, s.short_description
  from starter_categories s
  join public.categories c on c.slug = s.slug
   and ((s.parent_slug is null and c.parent_id is null)
        or c.parent_id = (select p.id from public.categories p where p.slug = s.parent_slug and p.parent_id is null))
on conflict do nothing;

create temp table starter_terms (kind public.term_kind, slug text, name text, aliases text[]);
insert into starter_terms values
  ('skill', 'prompt-engineering', 'Prompt engineering', array['prompting']::text[]),
  ('skill', 'rag', 'Retrieval-augmented generation (RAG)', array['rag', 'retrieval augmented generation']::text[]),
  ('skill', 'fine-tuning', 'Fine-tuning', array['finetuning']::text[]),
  ('skill', 'agent-design', 'AI agent design', array['agents', 'agentic', 'ai agents']::text[]),
  ('skill', 'conversational-design', 'Conversational design', array['conversation design']::text[]),
  ('skill', 'computer-vision-skill', 'Computer vision', array['cv', 'image recognition']::text[]),
  ('skill', 'nlp', 'Natural language processing', array['nlp', 'text analytics']::text[]),
  ('skill', 'time-series-forecasting', 'Time-series forecasting', array['forecasting', 'demand forecasting']::text[]),
  ('skill', 'data-engineering-skill', 'Data engineering', array['etl', 'data pipelines']::text[]),
  ('skill', 'mlops', 'MLOps', array['ml ops', 'llmops']::text[]),
  ('skill', 'llm-evaluation-skill', 'LLM evaluation', array['evals', 'evaluation']::text[]),
  ('skill', 'red-teaming-skill', 'Red-teaming', array['red teaming', 'ai safety testing']::text[]),
  ('skill', 'workflow-automation-skill', 'Workflow automation', array['automation', 'no-code automation']::text[]),
  ('skill', 'voice-ai', 'Voice AI', array['voice bot', 'voicebot', 'voice agent']::text[]),
  ('skill', 'speech-recognition-skill', 'Speech recognition', array['asr', 'speech to text', 'stt']::text[]),
  ('skill', 'document-ai-skill', 'OCR & document AI', array['ocr', 'idp', 'document processing']::text[]),
  ('skill', 'recommendation-systems-skill', 'Recommendation systems', array['recommender', 'recsys']::text[]),
  ('skill', 'data-visualization', 'Data visualization', array['dataviz', 'dashboards']::text[]),
  ('skill', 'ai-strategy', 'AI strategy', array['ai roadmap']::text[]),
  ('skill', 'ai-governance', 'AI governance', array['eu ai act', 'ai compliance']::text[]),
  ('skill', 'chatbot-development', 'Chatbot development', array['chatbot', 'chatbots', 'bot development']::text[]),
  ('skill', 'vector-search', 'Vector search', array['embeddings', 'semantic search']::text[]),
  ('skill', 'llm-integration', 'LLM integration', array['llm', 'genai', 'generative ai']::text[]),
  ('skill', 'web-scraping', 'Web scraping & data collection', array['scraping', 'crawling']::text[]),
  ('skill', 'machine-learning-skill', 'Machine learning', array['ml']::text[]),
  ('skill', 'deep-learning', 'Deep learning', array['neural networks', 'dl']::text[]),
  ('technology', 'openai-api', 'OpenAI API', array['openai', 'gpt', 'chatgpt']::text[]),
  ('technology', 'anthropic-claude', 'Anthropic Claude', array['claude', 'anthropic']::text[]),
  ('technology', 'google-gemini', 'Google Gemini', array['gemini']::text[]),
  ('technology', 'llama', 'Llama', array['meta llama']::text[]),
  ('technology', 'mistral', 'Mistral', '{}'::text[]),
  ('technology', 'hugging-face', 'Hugging Face', array['huggingface', 'hf']::text[]),
  ('technology', 'langchain', 'LangChain', array['lang chain']::text[]),
  ('technology', 'llamaindex', 'LlamaIndex', array['llama index']::text[]),
  ('technology', 'pytorch', 'PyTorch', array['torch']::text[]),
  ('technology', 'tensorflow', 'TensorFlow', array['tf']::text[]),
  ('technology', 'scikit-learn', 'scikit-learn', array['sklearn']::text[]),
  ('technology', 'pinecone', 'Pinecone', '{}'::text[]),
  ('technology', 'weaviate', 'Weaviate', '{}'::text[]),
  ('technology', 'pgvector', 'pgvector', '{}'::text[]),
  ('technology', 'supabase', 'Supabase', '{}'::text[]),
  ('technology', 'n8n', 'n8n', '{}'::text[]),
  ('technology', 'make', 'Make', array['integromat']::text[]),
  ('technology', 'zapier', 'Zapier', '{}'::text[]),
  ('technology', 'twilio', 'Twilio', '{}'::text[]),
  ('technology', 'vapi', 'Vapi', '{}'::text[]),
  ('technology', 'retell-ai', 'Retell AI', array['retell']::text[]),
  ('technology', 'elevenlabs', 'ElevenLabs', array['eleven labs']::text[]),
  ('technology', 'whisper', 'Whisper', '{}'::text[]),
  ('technology', 'stable-diffusion', 'Stable Diffusion', array['sdxl']::text[]),
  ('technology', 'aws-sagemaker', 'AWS SageMaker', array['sagemaker']::text[]),
  ('technology', 'google-vertex-ai', 'Google Vertex AI', array['vertex ai', 'vertex']::text[]),
  ('technology', 'azure-openai', 'Azure OpenAI', array['azure ai']::text[]),
  ('technology', 'python', 'Python', '{}'::text[]),
  ('technology', 'typescript', 'TypeScript', array['ts']::text[]),
  ('technology', 'fastapi', 'FastAPI', '{}'::text[]),
  ('technology', 'nextjs', 'Next.js', array['next.js', 'nextjs']::text[]),
  ('technology', 'docker', 'Docker', '{}'::text[]),
  ('technology', 'kubernetes', 'Kubernetes', array['k8s']::text[]),
  ('technology', 'databricks', 'Databricks', '{}'::text[]),
  ('technology', 'snowflake', 'Snowflake', '{}'::text[]),
  ('technology', 'dbt', 'dbt', '{}'::text[]),
  ('technology', 'power-bi', 'Power BI', array['powerbi']::text[]),
  ('technology', 'tableau', 'Tableau', '{}'::text[]),
  ('technology', 'opencv', 'OpenCV', '{}'::text[]),
  ('technology', 'yolo', 'YOLO', '{}'::text[]),
  ('industry', 'healthcare', 'Healthcare', array['medical', 'health']::text[]),
  ('industry', 'dental', 'Dental', array['dentist', 'dental clinic']::text[]),
  ('industry', 'legal', 'Legal', array['law', 'law firm']::text[]),
  ('industry', 'finance', 'Finance & banking', array['banking', 'fintech']::text[]),
  ('industry', 'insurance', 'Insurance', array['insurtech']::text[]),
  ('industry', 'real-estate', 'Real estate', array['property']::text[]),
  ('industry', 'ecommerce', 'E-commerce & retail', array['ecommerce', 'e-commerce', 'retail']::text[]),
  ('industry', 'education', 'Education', array['edtech']::text[]),
  ('industry', 'manufacturing', 'Manufacturing', array['industrial']::text[]),
  ('industry', 'logistics', 'Logistics & supply chain', array['supply chain']::text[]),
  ('industry', 'hospitality', 'Hospitality & travel', array['travel', 'hotels']::text[]),
  ('industry', 'marketing-industry', 'Marketing & advertising', array['advertising', 'agency']::text[]),
  ('industry', 'saas', 'Software & SaaS', array['software']::text[]),
  ('industry', 'public-sector', 'Public sector', array['government']::text[]),
  ('industry', 'non-profit', 'Non-profit', array['nonprofit', 'ngo']::text[]),
  ('industry', 'media', 'Media & entertainment', array['entertainment']::text[]),
  ('industry', 'telecom', 'Telecommunications', array['telecom']::text[]),
  ('industry', 'energy', 'Energy & utilities', array['utilities']::text[]),
  ('industry', 'agriculture', 'Agriculture', array['agritech']::text[]),
  ('industry', 'hr-recruiting', 'HR & recruiting', array['hr', 'recruiting']::text[]),
  ('industry', 'automotive', 'Automotive', '{}'::text[]);

insert into public.taxonomy_terms (kind, slug, status)
select kind, slug, 'active' from starter_terms
on conflict do nothing;
insert into public.taxonomy_term_translations (term_id, locale, name)
select t.id, 'en', s.name from starter_terms s join public.taxonomy_terms t on t.kind = s.kind and t.slug = s.slug
on conflict do nothing;
insert into public.taxonomy_term_aliases (term_id, alias, locale)
select t.id, a, 'en'
  from starter_terms s
  join public.taxonomy_terms t on t.kind = s.kind and t.slug = s.slug
  cross join unnest(s.aliases) a
on conflict do nothing;

-- Marketplace settings approved by the owner (PRODUCT_DECISIONS.md D-14, A-05, A-09, A-18).
-- Public so experts see the rules in the editor; changes go through audited admin code.
insert into public.platform_settings (key, value, description, is_public) values
  ('payments.provider_commission_bps', '1500', 'Greco commission deducted from provider earnings (15%, D-14).', true),
  ('payments.min_order_minor', '{"USD": 2500, "EUR": 2500}', 'Minimum order value per currency, in minor units (A-18).', true),
  ('payments.deposit_allowed_bps', '[2000, 3000, 4000, 5000]', 'Deposit percentages experts may choose, in basis points (A-05).', true),
  ('payments.deposit_min_order_minor', '{"USD": 30000, "EUR": 30000}', 'Minimum order value for the deposit model (A-05).', true),
  ('listings.currencies', '["USD", "EUR"]', 'Currencies experts can price listings in (A-09).', true)
on conflict (key) do nothing;

drop table starter_categories;
drop table starter_terms;
