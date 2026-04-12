import {groupIconUrls} from '../iconRegistryHelpers';

const icon_modules = import.meta.glob('../assets/MoreMegaStructure/*.png', {
    import: 'default',
    eager: true,
});

export default groupIconUrls(icon_modules).MoreMegaStructure || {};
