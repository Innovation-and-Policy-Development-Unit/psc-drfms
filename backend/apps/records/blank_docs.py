"""Minimal blank Word, Excel and PowerPoint files, so "New document" can open straight in the editor.

Built from the smallest valid OOXML packages (no extra libraries); the editor adds
everything else on first save.
"""
import io
import zipfile

NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
NS_OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

KINDS = {
    'word': ('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    'excel': ('xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    'powerpoint': ('pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
}


def _rels(*items):
    body = ''.join(f'<Relationship Id="{i}" Type="{NS_OFFICE_REL}/{t}" Target="{target}"/>' for i, t, target in items)
    return f'{XML}<Relationships xmlns="{NS_REL}">{body}</Relationships>'


def _content_types(defaults, overrides):
    d = ''.join(f'<Default Extension="{e}" ContentType="{c}"/>' for e, c in defaults)
    o = ''.join(f'<Override PartName="{p}" ContentType="{c}"/>' for p, c in overrides)
    return f'{XML}<Types xmlns="{NS_CT}">{d}{o}</Types>'


RELS_DEFAULTS = [
    ('rels', 'application/vnd.openxmlformats-package.relationships+xml'),
    ('xml', 'application/xml'),
]
CT = 'application/vnd.openxmlformats-officedocument'


def _docx():
    return {
        '[Content_Types].xml': _content_types(RELS_DEFAULTS, [('/word/document.xml', f'{CT}.wordprocessingml.document.main+xml')]),
        '_rels/.rels': _rels(('rId1', 'officeDocument', 'word/document.xml')),
        'word/document.xml': (
            f'{XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:body><w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>'
            '</w:sectPr></w:body></w:document>'
        ),
    }


def _xlsx():
    return {
        '[Content_Types].xml': _content_types(RELS_DEFAULTS, [
            ('/xl/workbook.xml', f'{CT}.spreadsheetml.sheet.main+xml'),
            ('/xl/worksheets/sheet1.xml', f'{CT}.spreadsheetml.worksheet+xml'),
        ]),
        '_rels/.rels': _rels(('rId1', 'officeDocument', 'xl/workbook.xml')),
        'xl/workbook.xml': (
            f'{XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="{NS_OFFICE_REL}">'
            '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        'xl/_rels/workbook.xml.rels': _rels(('rId1', 'worksheet', 'worksheets/sheet1.xml')),
        'xl/worksheets/sheet1.xml': (
            f'{XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>'
        ),
    }


def _pptx():
    a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    grp = (
        '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        f'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
        '</p:spTree></p:cSld>'
    )
    theme = (
        f'{XML}<a:theme xmlns:a="{a}" name="Office"><a:themeElements>'
        '<a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
        '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>'
        '<a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3>'
        '<a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6>'
        '<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme>'
        '<a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
        '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>'
        '<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
        '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>'
        '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
        '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>'
        '</a:themeElements></a:theme>'
    )
    return {
        '[Content_Types].xml': _content_types(RELS_DEFAULTS, [
            ('/ppt/presentation.xml', f'{CT}.presentationml.presentation.main+xml'),
            ('/ppt/slideMasters/slideMaster1.xml', f'{CT}.presentationml.slideMaster+xml'),
            ('/ppt/slideLayouts/slideLayout1.xml', f'{CT}.presentationml.slideLayout+xml'),
            ('/ppt/slides/slide1.xml', f'{CT}.presentationml.slide+xml'),
            ('/ppt/theme/theme1.xml', f'{CT}.theme+xml'),
        ]),
        '_rels/.rels': _rels(('rId1', 'officeDocument', 'ppt/presentation.xml')),
        'ppt/presentation.xml': (
            f'{XML}<p:presentation xmlns:a="{a}" xmlns:r="{NS_OFFICE_REL}" xmlns:p="{p}">'
            '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
            '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>'
            '<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'
        ),
        'ppt/_rels/presentation.xml.rels': _rels(
            ('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'),
            ('rId2', 'slide', 'slides/slide1.xml'),
            ('rId3', 'theme', 'theme/theme1.xml'),
        ),
        'ppt/slideMasters/slideMaster1.xml': (
            f'{XML}<p:sldMaster xmlns:a="{a}" xmlns:r="{NS_OFFICE_REL}" xmlns:p="{p}">{grp}'
            '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" '
            'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
            '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'
        ),
        'ppt/slideMasters/_rels/slideMaster1.xml.rels': _rels(
            ('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'),
            ('rId2', 'theme', '../theme/theme1.xml'),
        ),
        'ppt/slideLayouts/slideLayout1.xml': (
            f'{XML}<p:sldLayout xmlns:a="{a}" xmlns:r="{NS_OFFICE_REL}" xmlns:p="{p}" type="blank">{grp}</p:sldLayout>'
        ),
        'ppt/slideLayouts/_rels/slideLayout1.xml.rels': _rels(('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')),
        'ppt/slides/slide1.xml': f'{XML}<p:sld xmlns:a="{a}" xmlns:r="{NS_OFFICE_REL}" xmlns:p="{p}">{grp}</p:sld>',
        'ppt/slides/_rels/slide1.xml.rels': _rels(('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')),
        'ppt/theme/theme1.xml': theme,
    }


_BUILDERS = {'word': _docx, 'excel': _xlsx, 'powerpoint': _pptx}


def build_blank(kind):
    """(bytes, extension, mime_type) of an empty document of ``kind``; KeyError if unknown."""
    parts = _BUILDERS[kind]()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, content in parts.items():
            z.writestr(name, content)
    ext, mime = KINDS[kind]
    return buf.getvalue(), ext, mime
