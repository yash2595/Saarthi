"""Deterministic page commands. No provider calls or form submissions."""
import re
import unicodedata

ROUTES = [
    ('/kundali-creation', 'Kundali', r'kundali|kundli|birth chart|janam patri|कुंडली|कुण्डली'),
    ('/muhurat-finder', 'Muhurat', r'muhurat|muhurt|muhurth|shubh samay|मुहूर्त|शुभ समय'),
    ('/puja', 'Puja', r'puja|pooja|havan|katha|पूजा|हवन|कथा'),
    ('/', 'Home', r'home|homepage|main page|होम|मुख्य पृष्ठ'),
    ('/dashboard', 'My account', r'dashboard|profile|my account|mera account|प्रोफाइल'),
    ('/#contact', 'Contact', r'contact|sampark|support|संपर्क'),
    ('/#mission', 'About', r'about us|about|hamare bare|परिचय'),
]
ACTION = r'open|show|go to|take me|book|booking|find|kholo|khol|khol do|dikhao|banao|bana do|banwani|banani|karna|karni|karwani|chahiye|le chalo|खोलो|खोल|दिखाओ|बनाओ|बनवानी|चाहिए|बुक'
NEGATIVE = r"cancel|stop|nahi|nahin|nhi|mat|no|don't|do not|rehne do|chhodo|नहीं|मत|रहने दो"


def match(text, pattern):
    # Hindi combining marks must stay within a word; Python's \b splits them.
    return re.search(r'(?<![\w\u0900-\u097f])(?:' + pattern + r')(?![\w\u0900-\u097f])', text)


def resolve_navigation_target(message: str, pending=None) -> dict:
    text = unicodedata.normalize('NFKC', message or '').lower().strip()[:500]
    empty = {'target': None, 'needs_clarification': False, 'handled': False}
    if not text or re.search(r'https?://|\S+@\S+', text):
        return empty
    if re.match(r'(my (name|email|phone)|mera (naam|email|phone)|मेरा नाम)', text):
        return empty
    if match(text, NEGATIVE):
        clauses = re.split(r'[,;.!?।]|\b(?:but|instead|lekin|balki)\b|लेकिन|बल्कि', text)
        positive = [part for part in clauses if part.strip() and not match(part, NEGATIVE)]
        if not positive:
            tail = re.split(r'(?<!\w)(?:nahi|nahin|nhi|नहीं)(?!\w)', text)[-1]
            if tail != text and match(tail, ACTION):
                positive = [tail]
        if not positive:
            return {**empty, 'handled': True, 'clarification_msg': 'Theek hai, page nahi badla.'}
        text = ', '.join(positive)
    if pending:
        ordinal = re.fullmatch(r'(?:option\s*)?(first|pehla|पहला|second|dusra|doosra|दूसरा|third|teesra|तीसरा|last|aakhri|[1-9१-९])(?:\s+(?:wala|kholo|khol do|please|वाला|खोलो))*[.!।\s]*', text)
        if ordinal:
            key = ordinal[1]
            positions = {'first': 0, 'pehla': 0, 'पहला': 0, 'second': 1, 'dusra': 1, 'doosra': 1, 'दूसरा': 1, 'third': 2, 'teesra': 2, 'तीसरा': 2}
            index = positions.get(key, int(key) - 1 if key.isdecimal() else len(pending) - 1)
            if 0 <= index < len(pending):
                return {'target': pending[index], 'needs_clarification': False, 'handled': True}
        if text in {'haan', 'han', 'yes', 'हाँ', 'हां'} and len(pending) == 1:
            return {'target': pending[0], 'needs_clarification': False, 'handled': True}
        if ordinal or text in {'haan', 'han', 'yes', 'हाँ', 'हां'}:
            return {**empty, 'handled': True, 'needs_clarification': True, 'choices': pending,
                    'clarification_msg': 'List mein se page ka naam ya number bataiye.'}
    if match(text, r'wapas|wapis|back|pichla|वापस|पिछला') and not match(text, '|'.join(p[2] for p in ROUTES)):
        return {**empty, 'handled': True, 'action': 'GO_BACK'}
    if match(text, r'rashifal|horoscope|gemstone|panchang|choghadiya|राशिफल|पंचांग'):
        return {**empty, 'handled': True, 'clarification_msg': 'Yeh tool abhi available nahi hai. Puja, Kundali ya Muhurat page khol sakta hoon.'}
    if match(text, r'help|madad|मदद'):
        return {**empty, 'handled': True, 'clarification_msg': 'Puja, Kundali, Muhurat, Login ya Pandit registration mein se kaunsa page kholun?'}
    found = []
    pandit = bool(match(text, r'pandit|panditji|pandit ji|पंडित|पंडितजी'))
    for pattern, normal, special in [
        (r'login|log in|sign in|लॉगिन', '/login', '/login?role=pandit'),
        (r'signup|sign up|register|registration|join|banna|onboarding|पंजीकरण|रजिस्ट्रेशन|बनना', '/sign-up', '/sign-up?role=pandit'),
    ]:
        hit = match(text, pattern)
        if hit:
            found.append((hit.start(), special if pandit else normal))
    for target, _, pattern in ROUTES:
        hit = match(text, pattern)
        if hit:
            # A ceremony's muhurat is a single destination, unless explicitly alternatives.
            if target == '/puja' and match(text, ROUTES[1][2]) and not match(text, r'aur|ya|and|or|और|या'):
                continue
            found.append((hit.start(), target))
    if pandit and match(text, r'book|bulao|booking|बुक|बुलाओ'):
        found.append((0, '/puja'))
    targets = list(dict.fromkeys(target for _, target in sorted(found)))
    if not targets:
        return empty
    information = match(text, r'what is|kya hai|meaning|matlab|क्या है|मतलब|samagri|jankari')
    # Bare page names are valid; incidental mentions inside personal/general speech aren't.
    if not match(text, ACTION) and not information and not found[0][1].startswith(('/login', '/sign-up')):
        rest = text
        for _, _, pattern in ROUTES:
            rest = re.sub(pattern, '', rest)
        rest = re.sub(r'page|please|ya|aur|and|or|पेज|और|या', '', rest)
        if re.search(r'[\w\u0900-\u097f]', rest):
            return empty
    if len(targets) > 1 or information:
        labels = {route: label for route, label, _ in ROUTES}
        choices = ' / '.join(f'{i+1}. {labels.get(route, route)}' for i, route in enumerate(targets))
        return {**empty, 'handled': True, 'needs_clarification': True, 'choices': targets,
                'clarification_msg': f'Kaunsa page kholun? {choices}. Naam ya number bataiye.'}
    result = {'target': targets[0], 'needs_clarification': False, 'handled': True}
    if targets[0] == '/puja':
        for pattern, service in [(r'ganesh|ganesha|गणेश', 'Ganesh Puja'), (r'satyanarayan|सत्यनारायण', 'Satyanarayan'),
                                 (r'rudra|rudrabhishek|रुद्राभिषेक', 'Rudra Abhishek')]:
            if match(text, pattern):
                result.update(query=service, service=service)
                break
    return result


def is_navigation_command(message: str) -> bool:
    return resolve_navigation_target(message).get('handled', False)
