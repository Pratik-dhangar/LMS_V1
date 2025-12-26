import re

# Read the CSS file
with open('../src/styles/GuestBooking.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Function to add .guest-booking-flow scope to selectors
def scope_selector(match):
    selector = match.group(1).strip()
    # Don't scope @keyframes, @media, or already scoped selectors
    if selector.startswith('@') or selector.startswith('.guest-booking-flow'):
        return match.group(0)
    # Add the scope
    return f'.guest-booking-flow {selector} {{'

# Replace class selectors that start a rule (followed by {)
# Match patterns like: .class-name {  or  .class-name.another-class {
scoped_css = re.sub(r'^((?:\.[a-zA-Z][\w-]*)+(?:\s*,\s*(?:\.[a-zA-Z][\w-]*)+)*)\s*\{', 
                     scope_selector, css_content, flags=re.MULTILINE)

# Also handle selectors within media queries
# Match patterns like:  .class { inside @media blocks
lines = scoped_css.split('\n')
result_lines = []
in_media_query = False

for line in lines:
    # Check if we're entering a media query
    if '@media' in line:
        in_media_query = True
        result_lines.append(line)
    # Check if we're exiting (closing brace at start of line in media context)
    elif in_media_query and line.strip() == '}':
        in_media_query = False
        result_lines.append(line)
    # If inside media query and line starts with selector
    elif in_media_query and re.match(r'^\s*(\.[a-zA-Z][\w-]*)', line):
        # Add scope if not already scoped
        if '.guest-booking-flow' not in line:
            indented_match = re.match(r'^(\s*)(\.[a-zA-Z][\w-]*.*\{)', line)
            if indented_match:
                indent = indented_match.group(1)
                selector_part = indented_match.group(2)
                result_lines.append(f'{indent}.guest-booking-flow {selector_part}')
            else:
                result_lines.append(line)
        else:
            result_lines.append(line)
    else:
        result_lines.append(line)

scoped_css = '\n'.join(result_lines)

# Write the scoped CSS back
with open('../src/styles/GuestBooking.css', 'w', encoding='utf-8') as f:
    f.write(scoped_css)

print("CSS file has been scoped with .guest-booking-flow")
