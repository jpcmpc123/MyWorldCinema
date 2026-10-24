import json
import os
import random

# Esquema de perguntas
with open("tmdb_recommender/movie_questions.json", "r", encoding="utf-8") as f:
    movie_questions = json.load(f)

# Base rica e abrangente com todas as 18 classes do TMDB, filmes emblemáticos, gírias e sinônimos
genres_data = {
    "action": {
        "titles": ["John Wick", "Resgate", "Missao Impossivel", "Velozes e Furiosos", "Mad Max: Estrada da Furia", "Duro de Matar", "Top Gun: Maverick", "Carga Explosiva", "Busca Implacavel"],
        "terms": ["acao frenetica", "tiroteio e bala para todo lado", "artes marciais e porrada", "perseguicao de carros em alta velocidade", "muita adrenalina e explosoes", "agente secreto e missoes perigosas", "lutas coreografadas intensas", "vinganca com sangue nos olhos", "resgate armado com forcas especiais"],
        "moods": ["intense", "intense"],
        "ratings": ["16", "14", "18"]
    },
    "adventure": {
        "titles": ["Indiana Jones", "Uncharted", "Jumanji", "As Aventuras de Pi", "A Lenda do Tesouro Perdido", "A Mumia", "Viagem ao Centro da Terra", "King Kong"],
        "terms": ["aventura e exploracao", "jornada epica pela selva desconhecida", "cacada a tesouro antigo e templos perdidos", "expedicao em ilha misteriosa cheia de perigos", "mapas secretos e armadilhas ancestrais", "viagem emocionante cheia de descobertas", "sobrevivencia na natureza selvagem"],
        "moods": ["lighthearted", "intense"],
        "ratings": ["12", "10", "L"]
    },
    "animation": {
        "titles": ["Toy Story", "Divertida Mente", "Shrek", "Como Treinar o Seu Dragao", "Viva: A Vida e uma Festa", "Meu Malvado Favorito", "Kung Fu Panda", "Procurando Nemo", "O Rei Leao", "Your Name", "A Viagem de Chihiro"],
        "terms": ["desenho animado infantil bem colorido", "animacao 3D da Pixar com licao de vida", "anime japones lindo e emocionante", "animacao fofa para assistir com criancas pequenas", "desenho engraçado com animais falantes", "animacao magica para reunir a familia no sofa", "fantasia animada com personagens carismaticos"],
        "moods": ["lighthearted", "emotional"],
        "ratings": ["L", "L", "10"]
    },
    "comedy": {
        "titles": ["Superbad", "Se Beber Nao Case", "As Branquelas", "Todo Mundo em Panico", "Gente Grande", "O Mentiroso", "Debi e Loide", "Click", "Deadpool"],
        "terms": ["comedia de morrer de rir", "filme engracado e divertido para relaxar", "humor besteirol e piadas engracadas", "situacoes hilarias e confusoes absurdas", "comedia escrachada para dar muitas gargalhadas", "humor pastelao para desestressar o dia", "comedia leve e bem-humorada com amigos"],
        "moods": ["lighthearted"],
        "ratings": ["12", "14", "16", "L"]
    },
    "crime": {
        "titles": ["O Poderoso Chefao", "Os Bons Companheiros", "Scarface", "Cidade de Deus", "Pulp Fiction", "Os Infiltrados", "Tropa de Elite", "La Casa de Papel"],
        "terms": ["mafia italiana e crime organizado", "assalto a banco muito bem planejado", "trafico de drogas, favela e submundo do crime", "policiais corruptos contra gangues perigosas", "faccoes criminosas e guerras de territorio", "esquema financeiro criminoso e lavagem de dinheiro", "golpistas geniais enganando a policia"],
        "moods": ["dark", "intense"],
        "ratings": ["16", "18"]
    },
    "documentary": {
        "titles": ["Nosso Planeta", "Arremesso Final", "Wild Wild Country", "Planeta Terra", "A Marcha dos Pinguins", "Professor Polvo"],
        "terms": ["documentario real e factual", "historia veridica sobre a natureza e animais", "investigacao real sobre crimes e serial killers", "biografia documentada de personalidades historicas", "exploracao cientifica e astronomica da vida real", "grandes acontecimentos historicos reais e testemunhos"],
        "moods": ["mysterious", "lighthearted"],
        "ratings": ["L", "10", "12"]
    },
    "drama": {
        "titles": ["A Procura da Felicidade", "Milagre na Cela 7", "A Lista de Schindler", "Sempre ao Seu Lado", "Forrest Gump", "O Menino do Pijama Listrado", "Manchester a Beira-Mar"],
        "terms": ["drama emocionante de chorar rios de lagrimas", "historia tocante de superacao e perdas familiares", "drama profundo com atuacoes emocionantes", "luto, saudade e reconstrucao emocional", "dilemas humanos reais e conflitos morais dolorosos", "relacao dificil entre pai e filho comovente"],
        "moods": ["emotional", "dark"],
        "ratings": ["12", "14", "16"]
    },
    "family": {
        "titles": ["Esqueceram de Mim", "Matilda", "Extraordinario", "Marley e Eu", "As Cronicas de Narnia", "Pequena Miss Sunshine"],
        "terms": ["filme de familia para reunir todo mundo no domingo", "historia fofa e inspiradora para todas as idades", "filme confortavel e acolhedor para ver com pais e filhos", "aventura classica de natal em familia", "historias bonitas com cachorros e animais de estimacao"],
        "moods": ["lighthearted", "emotional"],
        "ratings": ["L", "L", "10"]
    },
    "fantasy": {
        "titles": ["Harry Potter", "O Senhor dos Aneis", "O Hobbit", "Percy Jackson", "Animais Fantasticos", "Eragon", "A Roda do Tempo"],
        "terms": ["magia, feiticeiros e escolas de bruxaria", "reinos medievais encantados, elfos e anoes", "batalhas com dragoes cospe-fogo e monstros mitologicos", "espadas magicas, feiticos antigos e profecias", "mundo magico de fantasia e poderes sobrenaturais"],
        "moods": ["mysterious", "intense"],
        "ratings": ["10", "12", "14"]
    },
    "history": {
        "titles": ["Gladiador", "Oppenheimer", "Coracao Valente", "1917", "Alexandre", "Dunkirk", "O Discurso do Rei", "Apocalypto"],
        "terms": ["filme de epoca sobre imperios e imperadores antigos", "Roma antiga, Coliseu e combates historicos", "fatos historicos reais sobre guerras do passado", "realeza britanica, conspiracoes na corte e reis", "biografia de figuras politicas que mudaram o mundo"],
        "moods": ["intense", "emotional"],
        "ratings": ["14", "16"]
    },
    "horror": {
        "titles": ["Invocacao do Mal", "Sobrenatural", "O Exorcista", "Hereditario", "Panico", "Sexta-Feira 13", "It: A Coisa", "O Chamado", "Terrifier"],
        "terms": ["terror pesado para dar susto e gelar a espinha", "casa assombrada por espiritos malignos e demonios", "filme macabro de rituais e possessao demoniaca", "slasher sangrento com assassino de mascara", "terror psicologico angustiante e sufocante", "criaturas monstruosas assustadoras na escuridao"],
        "moods": ["dark", "intense"],
        "ratings": ["16", "18"]
    },
    "music": {
        "titles": ["La La Land", "O Rei do Show", "Bohemian Rhapsody", "Rocketman", "Nasce Uma Estrela", "Mamma Mia!", "Whiplash"],
        "terms": ["musical alegre com dancas e coreografias grandiosas", "biografia de estrelas da musica e bandas famosas", "paixao pela musica e solos de bateria intensos", "cancoes inesqueciveis e trilhas sonoras maravilhosas", "artistas cantando em busca do estrelato"],
        "moods": ["lighthearted", "emotional"],
        "ratings": ["L", "12", "14"]
    },
    "mystery": {
        "titles": ["Entre Facas e Segredos", "Sherlock Holmes", "Os Suspeitos", "Ilha do Medo", "Garota Exemplar", "Zodiaco", "Assassinato no Expresso do Oriente"],
        "terms": ["misterio intrigante para descobrir quem e o assassino", "investigacao detalhada cheia de pistas e quebra-cabecas", "detetive brilhante desvendando um crime impossivel", "reviravoltas chocantes e enigmas complexos", "casos misteriosos sem solucao aparente"],
        "moods": ["mysterious"],
        "ratings": ["12", "14", "16"]
    },
    "romance": {
        "titles": ["Diario de Uma Paixao", "Como Eu Era Antes de Voce", "Orgulho e Preconceito", "A Culpa e das Estrelas", "Titanic", "Uma Linda Mulher", "Questao de Tempo"],
        "terms": ["historia de amor linda e apaixonante", "romance doce para assistir debaixo do cobertor", "casal que enfrenta todas as dificuldades para ficar junto", "comedia romantica com paixao a primeira vista", "encontros e desencontros do amor verdadeiro"],
        "moods": ["emotional", "lighthearted"],
        "ratings": ["L", "10", "12", "14"]
    },
    "scifi": {
        "titles": ["Interestelar", "Perdido em Marte", "Matrix", "Blade Runner 2049", "Duna", "A Chegada", "Star Wars", "Ex Machina"],
        "terms": ["ficcao cientifica no espaco com buracos negros e galaxias", "viagem no tempo, paradoxos temporais e fisica quantica", "futuro distopico com inteligencia artificial e robos", "naves espaciais explorando planetas alienigenas distantes", "tecnologia futurista e invasao de seres extraterrestres"],
        "moods": ["intense", "mysterious"],
        "ratings": ["12", "14", "16"]
    },
    "thriller": {
        "titles": ["O Silencio dos Inocentes", "Seven: Os Sete Crimes Capitais", "Corra!", "Um Lugar Silencioso", "Psicose", "Parasita", "O Homem Invisivel"],
        "terms": ["suspense psicologico sufocante e roer as unhas", "perseguicao tensa a um psicopata perigoso", "clima de paranoia onde nao se sabe em quem confiar", "tensao constante e reviravoltas imprevisiveis", "jogo mental perigoso de gato e rato"],
        "moods": ["dark", "intense"],
        "ratings": ["14", "16", "18"]
    },
    "war": {
        "titles": ["O Resgate do Soldado Ryan", "1917", "Ate o Ultimo Homem", "Platoon", "Apocalypse Now", "Nada de Novo no Front", "Corações de Ferro"],
        "terms": ["guerra militar realista no campo de batalha", "soldados enfrentando trincheiras e fogo cruzado", "Segunda Guerra Mundial com tanques e invasoes", "missoes no front de batalha com herois de guerra", "o drama e a brutalidade dos conflitos armados"],
        "moods": ["intense", "dark"],
        "ratings": ["16", "18"]
    },
    "western": {
        "titles": ["Django Livre", "Tres Homens em Conflito", "Os Oito Odiados", "Bravura Indomita", "Por Um Punhado de Dolares", "Sete Homens e Um Destino"],
        "terms": ["faroeste raiz com duelo de revolveres ao meio-dia", "velho oeste americano com pistoleiros e cowboys", "cacador de recompensas a cavalo no deserto", "saloon, cavalos e xerifes protegendo o vilarejo", "tiroteio rustico bang-bang nas planicies aridas"],
        "moods": ["intense"],
        "ratings": ["14", "16"]
    }
}

prefixes = [
    "Quero um filme de {term}.",
    "Recomende algo no estilo de {title}.",
    "Gosto muito de {title}, me indique algo parecido com {term}.",
    "Estou procurando um filme tipo {title} com {term}.",
    "Me indica um filme com {term} no mesmo estilo de {title}.",
    "Adoro {title}, quero ver algo parecido.",
    "Quero assistir {term} para relaxar hoje a noite.",
    "Filme com {term} e ritmo envolvente.",
    "Buscando filme no estilo de {title} que tenha {term}."
]

dataset = []
random.seed(42)

for g_key, info in genres_data.items():
    for title in info["titles"]:
        for _ in range(2):
            term = random.choice(info["terms"])
            template = random.choice(prefixes)
            state = template.format(term=term, title=title)
            m = random.choice(info["moods"])
            r = random.choice(info["ratings"])
            
            dataset.append({
                "state": state,
                "questions": movie_questions,
                "expected": {
                    "genre": g_key,
                    "mood": m,
                    "content_rating": r
                }
            })
    # Adiciona frases puras sem título específico para reforçar vocabulário
    for term in info["terms"]:
        dataset.append({
            "state": f"Quero ver um filme de {term}.",
            "questions": movie_questions,
            "expected": {
                "genre": g_key,
                "mood": random.choice(info["moods"]),
                "content_rating": random.choice(info["ratings"])
            }
        })

random.shuffle(dataset)

out_file = "tmdb_recommender/train_full_100pct.jsonl"
with open(out_file, "w", encoding="utf-8") as f:
    for item in dataset:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

print(f"Dataset expandido criado com {len(dataset)} exemplos em {out_file}!")
